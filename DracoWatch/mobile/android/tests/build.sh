#!/usr/bin/env bash
set -euo pipefail
umask 077
native_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
sdk_root=${DRACO_ANDROID_SDK:-/home/azulus/Android/Sdk}
jdk_root=${DRACO_JDK:-/home/azulus/.gradle/jdks/eclipse_adoptium-21-amd64-linux.2}
tools_root="$sdk_root/build-tools/35.0.0"
output_root="$native_root/build/native-checks"
rm -rf "$output_root/classes" "$output_root/dex"
mkdir -p "$output_root/classes" "$output_root/dex"
"$tools_root/aapt2" link -o "$output_root/resources.apk" --manifest "$native_root/tests/AndroidManifest.xml" -I "$sdk_root/platforms/android-35/android.jar"
# Transport/callback regressions exercise current source even when the target APK
# is the previous signed release. This is an instrumentation-only override;
# it does not rebuild or replace the production application's APK/assets.
"$jdk_root/bin/javac" -source 8 -target 8 -Xlint:-options -bootclasspath "$sdk_root/platforms/android-35/android.jar:$tools_root/core-lambda-stubs.jar" -classpath "$native_root/build/classes:$(paste -sd: "$native_root/build/dependencies/jars.txt")" -d "$output_root/classes" \
    "$native_root/src/org/omega/dracowatch/DracoClient.java" \
    "$native_root/src/org/omega/dracowatch/NativeCallbacks.java" \
    "$native_root/src/org/omega/dracowatch/MonitorActivity.java" \
    "$native_root/tests/src/org/omega/dracowatch/TelegramBridgeChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/TelegramSurfaceChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/NativeChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/AudioPolicyChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/WorkStreamChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/MediaLinkChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/AcceptedAudioChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/ViewportEvidenceChecks.java" \
    "$native_root/tests/src/org/omega/dracowatch/CompetingAudioActivity.java" \
    "$native_root/tests/src/org/omega/dracowatch/CompetingAudioService.java"
"$jdk_root/bin/jar" --create --file "$output_root/classes.jar" -C "$output_root/classes" .
"$tools_root/d8" --release --min-api 26 --lib "$sdk_root/platforms/android-35/android.jar" --classpath "$native_root/build/classes.jar" --output "$output_root/dex" "$output_root/classes.jar"
cp "$output_root/resources.apk" "$output_root/unsigned.apk"
(cd "$output_root/dex" && zip -q -X "$output_root/unsigned.apk" classes*.dex)
"$tools_root/zipalign" -f -p 4 "$output_root/unsigned.apk" "$output_root/aligned.apk"
"$tools_root/apksigner" sign --ks "${DRACO_SIGNING_KEY:-/home/azulus/.android/debug.keystore}" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$output_root/native-checks.apk" "$output_root/aligned.apk"
"$tools_root/apksigner" verify "$output_root/native-checks.apk"
printf 'Native test APK: %s\n' "$output_root/native-checks.apk"
