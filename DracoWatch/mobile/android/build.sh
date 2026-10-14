#!/usr/bin/env bash
set -euo pipefail
umask 077

# No Android Gradle plugin or network dependency resolution is required.
android_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mobile_root="$(dirname -- "$android_root")"
sdk_root="${DRACO_ANDROID_SDK:-/home/azulus/Android/Sdk}"
jdk_root="${DRACO_JDK:-/home/azulus/.gradle/jdks/eclipse_adoptium-21-amd64-linux.2}"
tools_root="$sdk_root/build-tools/35.0.0"
android_jar="$sdk_root/platforms/android-35/android.jar"
build_root="$android_root/build"
ui_root="$mobile_root/ui"
profile_path="${DRACO_PROFILE:-$mobile_root/runtime/profile.json}"

for required in "$jdk_root/bin/javac" "$jdk_root/bin/jar" "$tools_root/aapt2" \
    "$tools_root/d8" "$tools_root/zipalign" "$tools_root/apksigner" "$android_jar"; do
    if [[ ! -f "$required" ]]; then
        printf 'Missing Android build tool: %s\n' "$required" >&2
        exit 1
    fi
done
for ui_name in index.html app.js styles.css chamber.js environment.js environment-bubbles.js client-state.js reply-speech.js; do
    if [[ ! -f "$ui_root/$ui_name" ]]; then
        printf 'Missing phone UI asset: %s\n' "$ui_name" >&2
        exit 1
    fi
done

rm -rf -- "$build_root/classes" "$build_root/generated" "$build_root/dex" "$build_root/assets/www"
mkdir -p "$build_root/classes" "$build_root/generated" "$build_root/dex" "$build_root/assets/www"
for ui_name in index.html app.js styles.css chamber.js environment.js environment-bubbles.js client-state.js reply-speech.js; do
    cp -- "$ui_root/$ui_name" "$build_root/assets/www/$ui_name"
done
# This profile contains only the personal phone-relay bearer, never a gateway token.
# Treat every packaged APK as private; preserve the same signing key across updates. It is intentionally
# confined to ignored generated output and the private personal APK.
rm -f -- "$build_root/assets/profile.json"
if [[ -f "$profile_path" ]]; then
    python3 - "$profile_path" "$build_root/assets/profile.json" <<'PY'
import json, pathlib, re, sys, urllib.parse
try:
    source = pathlib.Path(sys.argv[1])
    if source.stat().st_size > 8192:
        raise ValueError()
    value = json.loads(source.read_text())
    origins = [value['url'], *value.get('alternateUrls', [])]
    if len(origins) > 4:
        raise ValueError()
    for origin in origins:
        uri = urllib.parse.urlsplit(origin)
        if (uri.scheme != 'https' or not uri.hostname or uri.username is not None
            or uri.password is not None or uri.query or uri.fragment or uri.path not in ('', '/')
            or uri.port == 0):
            raise ValueError()
    if not re.fullmatch(r'[A-Za-z0-9_.~\-]{32,512}', value['token']):
        raise ValueError()
    if not re.fullmatch(r'[a-fA-F0-9]{64}', value['certificateSha256'].replace(':', '')):
        raise ValueError()
    clean = {key: value[key] for key in ('url', 'token', 'certificateSha256')}
    if value.get('alternateUrls'):
        clean['alternateUrls'] = value['alternateUrls']
    destination = pathlib.Path(sys.argv[2])
    destination.write_text(json.dumps(clean, separators=(',', ':')))
    destination.chmod(0o600)
except Exception:
    print('The private pairing profile is invalid; no credentials were printed.', file=sys.stderr)
    sys.exit(1)
PY
fi

"$tools_root/aapt2" compile --dir "$android_root/res" -o "$build_root/resources.zip"
manifest_path="$android_root/AndroidManifest.xml"
if [[ -n "${DRACO_VERSION_CODE:-}" || -n "${DRACO_VERSION_NAME:-}" ]]; then
    manifest_path="$build_root/AndroidManifest.xml"
    python3 - "$android_root/AndroidManifest.xml" "$manifest_path" "${DRACO_VERSION_CODE:-2}" "${DRACO_VERSION_NAME:-0.2.0}" <<'PYVERSION'
import pathlib, re, sys
code, name = sys.argv[3:]
if not re.fullmatch(r'[1-9][0-9]{0,8}', code) or not re.fullmatch(r'[A-Za-z0-9.+_-]{1,80}', name):
    raise SystemExit('Invalid build version')
text = pathlib.Path(sys.argv[1]).read_text()
text = re.sub(r'android:versionCode="[^"]*"', f'android:versionCode="{code}"', text)
text = re.sub(r'android:versionName="[^"]*"', f'android:versionName="{name}"', text)
pathlib.Path(sys.argv[2]).write_text(text)
PYVERSION
fi
"$tools_root/aapt2" link -o "$build_root/resources.apk" \
    --manifest "$manifest_path" -I "$android_jar" \
    -R "$build_root/resources.zip" -A "$build_root/assets" \
    --java "$build_root/generated" --auto-add-overlay
mapfile -t java_sources < <(rg --files "$android_root/src" "$android_root/telegram/src" "$build_root/generated" -g '*.java')
"$jdk_root/bin/javac" -source 8 -target 8 -Xlint:-options \
    -bootclasspath "$android_jar:$tools_root/core-lambda-stubs.jar" \
    -d "$build_root/classes" "${java_sources[@]}"
"$jdk_root/bin/jar" --create --file "$build_root/classes.jar" -C "$build_root/classes" .
"$tools_root/d8" --release --min-api 26 --lib "$android_jar" \
    --output "$build_root/dex" "$build_root/classes.jar"
cp -- "$build_root/resources.apk" "$build_root/unsigned.apk"
(cd -- "$build_root/dex" && zip -q -X "$build_root/unsigned.apk" classes*.dex)
"$tools_root/zipalign" -f -p 4 "$build_root/unsigned.apk" "$build_root/aligned.apk"

signing_key="${DRACO_SIGNING_KEY:-/home/azulus/.android/debug.keystore}"
if [[ ! -f "$signing_key" ]]; then
    if [[ -f "$android_root/.private/debug.keystore" ]]; then
        signing_key="$android_root/.private/debug.keystore"
    else
        printf 'Existing app signing key unavailable; set DRACO_SIGNING_KEY to the original key. No replacement key was generated.\n' >&2
        exit 1
    fi
fi

"$tools_root/apksigner" sign --ks "$signing_key" --ks-key-alias androiddebugkey \
    --ks-pass pass:android --key-pass pass:android \
    --out "$build_root/draco-watch-debug.apk" "$build_root/aligned.apk"
"$tools_root/apksigner" verify "$build_root/draco-watch-debug.apk"
"$tools_root/zipalign" -c -p 4 "$build_root/draco-watch-debug.apk"
printf 'Built and verified: %s\n' "$build_root/draco-watch-debug.apk"
sha256sum "$build_root/draco-watch-debug.apk"
