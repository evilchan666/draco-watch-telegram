# DRACO Watch Android client

Personal six-agent client, package `org.omega.dracowatch`, activity
`org.omega.dracowatch.MonitorActivity`. Android 8+ (API 26), target API 35.
The package and signing key match 0.1.0 for an in-place update. App debugging,
backup, cleartext traffic and arbitrary WebView networking remain disabled.

## Build and install

Run `./build.sh` using the installed SDK/build-tools 35 and cached JDK 21.
Optional path variables are `DRACO_ANDROID_SDK`, `DRACO_JDK`, `DRACO_PROFILE`
and `DRACO_SIGNING_KEY`. Generated personal APK:

`build/draco-watch-debug.apk`

The name describes the existing personal signing key, not an enabled debugger.
**Do not generate a replacement signing key:** Android updates require the same
key as the installed application. The existing key is reused by default.
`DRACO_VERSION_CODE` / `DRACO_VERSION_NAME` override the packaged manifest only
inside ignored build output for isolated update tests. Never publish test fixtures.

The APK contains a private phone-relay profile, so it is an operator-private
artifact. No gateway bearer is packaged or passed into JavaScript. The native
pairing profile is persisted in private preferences, including its initial bundled
profile, and survives app updates. Explicit replacement uses the native pairing
dialog. Settings opens Android's own uninstall prompt for this package using the
normal `REQUEST_DELETE_PACKAGES` permission required by current Android targets.
If an Android uninstaller cannot be started, the entry falls back to this app's
application-settings screen. No self-delete or silent installation is claimed.

## Pinned native bridge

Only bundled `index.html`, `app.js`, `chamber.js`, `environment.js`, `environment-bubbles.js`, `client-state.js`, `reply-speech.js`, and `styles.css`
render under `https://draco.local`. File access, cookies, redirects, remote resources,
iframes and injected network clients are blocked. Remote JSON is delivered through
quoted JSON parsing, never executable interpolation. HTTPS uses the exact paired
leaf-certificate SHA-256 pin **and normal hostname verification**, with no trust-all
certificate/hostname bypass.

Successful authenticated transport promotes that paired origin for subsequent
requests/downloads. Failed connections still fall back within the paired list;
an admitted POST is never automatically replayed. Large callback JSON is quoted
on its IO worker, rather than doing that copy on Android's UI thread.

`DracoNative.refresh(agent)` delivers `onDracoSnapshot`. General requests use
`DracoNative.request(id, method, path, JSONbody)` and `onDracoResponse`:

- GET snapshot/history for a fixed six-agent whitelist, capabilities, and update.
- POST message, exact abort, and speech. Other write routes are unavailable.
- A POST may fall back to the alternate paired origin only before its output stream
  is admitted. Any subsequent transport ambiguity is `uncertain:true` and is not
  retried automatically. API idempotency keys remain unchanged.
- JSON replies are bounded to 6 MiB; request bodies to 12 MiB, including native media
  encoding. No credential or remote exception detail is printed or logged.
- Text/control requests use two reserved IO workers. Snapshot observation has its
  own reserved worker, separate from history/capability reads. Speech, attachment
  uploads, media and update work use the bulk pool. Slow history cannot occupy the
  observation lane; downloads cannot occupy text-send/control workers.
- Progress is throttled to roughly 150 ms or five percentage points. While the
  Activity is paused, only latest cosmetic progress is coalesced/bounded. Original
  response/acknowledgement callbacks retain identity and relative order, are never
  dropped to make room for progress, and are delivered before cosmetic backlog.

JavaScript sends `attachmentIds` with the explicit message action. Native code
replaces these with the gateway's typed media payload. Picking/recording/previewing
never contacts an agent. `onDracoResponse` returns `{id,ok,status,data,error?,uncertain?}`;
`unconfirmed` is retained as an alias. Known local rejections carry `uncertain:false`.

## Media and permissions

`chooseAttachment()` opens Android's scoped Open Document picker, supports multiple
items, and never asks for all-files/storage access. Each imported item emits
`onDracoAttachment({id,state,name,mimeType,sizeBytes,durationMs,preview?})`.
Images are limited to 6 MiB; a complete explicit send to eight attachments and an
8 MiB aggregate. Staged bytes stay in private app storage. Global storage is bounded
to 64 MiB / 128 items and metadata survives process recreation and app updates.

`startRecording()` requests microphone access only after a user action and records
AAC in an M4A container, at most 120 seconds / 8 MiB. `stopRecording()` stages the
result for review. Activity pause stops recording rather than keeping a hidden
microphone active. `previewAttachment(id)` plays local staged media with no dispatch.
`cancelAttachment(id)` removes precisely the chosen unsent item.
The Documents picker's exact pending recipient is saved across Activity recreation;
an expired/unrestorable selection is explicitly rejected without guessing a recipient.
`releaseAttachment(id)` removes an accepted submission's bytes without a cancellation
callback; the UI must **never release an uncertain submission**. `stagedAttachments()`
returns metadata only for restore validation.

`playMedia(attestedPath,id)` downloads protected media through the pinned authenticated
native client (32 MiB maximum), then uses MediaPlayer, native VideoView controls,
fullscreen pinch-to-zoom image viewing, or a read-only temporary URI grant to Android's
document viewer. WebView never fetches remote audio/video/file URLs. `stopMedia()` and
lifecycle pause stop playback; `onDracoPlayback` carries real loading/playing/stopped/
ended/viewing/opened/error states. Copy, Share and opening explicit HTTP(S) links
use Android system APIs. ACTION_SEND imports text/files into review, never dispatches.
Playback is currently foreground-only: switching apps or locking the phone stops
audio. Background/lockscreen playback and MediaSession controls are not implemented.

## Layout and background observation

The WebView uses Android density-independent viewport sizing and system font scale,
not the physical pixel width of a high-resolution panel. Native system-bar/cutout/IME
insets resize the composer in portrait and landscape. App info provides low-memory,
font-scale and density hints for the UI's optional lighter chamber renderer.

Notifications are off by default. `setNotifications(true)` requests Android 13+
notification permission and schedules Android-managed hourly observation, subject
to OS battery/network scheduling. It checks signed updates and the selected agent's
public reply projection; it never starts an agent, polls a model, sends a command,
or invents real-time push delivery. Disable the switch to cancel the scheduled job.

## Automatic update pipeline

Startup/resume checks read the authenticated pinned `/v1/update` manifest. New versions
automatically download into private verified cache. The manifest must name this
package, fixed `/v1/update/apk` path, version, bounded bytes and SHA-256. An optional
signing-certificate hash is checked against the installed app before download.
The downloaded APK must match the SHA-256, byte count, exact package, higher version,
and **all installed signing certificates** before it can reach the installer.

Cache files are content-hash-addressed with unique download temporaries. A shared
prepare/installer-copy lock prevents foreground/job races; the exact stream copied
into PackageInstaller is hashed again before commit. Android receives a user-action-
required install session. Unknown-source permission uses Android's own settings and
resumes the verified install after return. Android consent cannot and does not become
silent automatic installation. Existing app data and pairing are preserved by the
same-package, same-signer update.

## Device verification

`tests/build.sh` produces an isolated same-signer instrumentation APK. The checks
cover closed route/URI validation, actual native attachment encoding and durable
recreation, accepted release versus uncertain retention, update manifest bounds,
higher-version matching and rejection of an otherwise valid wrong-signer APK.
No agent input/control or network requests are made by these tests.

Compilation/signature checks and emulator interactions are separate evidence.
The isolated Android 15 AVD is used with S25 Ultra and A15 logical display/font
configurations. This does not establish performance on either physical handset.

## Adaptive spatial view, 0.2.4

Five persistent destinations: Chats, Chamber, Environment, Activity, Settings.
Environment is a bundled Canvas2D perspective interior derived from this project's
own vessel design and six silhouettes. It is an animated spatial representation of
observed state, not proof of physical agent location, task progress or completion.
Selection opens the same exact-recipient conversation; it never sends agent input.
Unknown/expired state and app backgrounding stop activity animation. Reduce motion
and lightweight 30fps rendering apply to both spatial views.

Layout is based on available density-independent viewport and real font scale,
not a device-name/A15 profile. Extra width/height gives the room and inbox additional
space; narrow/large-text navigation wraps labels rather than reducing font scale.

## Overhead Environment, 0.2.5

Environment now uses a top-down orthographic floor plan rather than foreshortened
perspective. The larger floor remains in view without a caption obscuring stations;
wide screens rotate the map to use their available space. Overhead avatar forms
preserve all six existing identities and colours; Chamber is unchanged.

Observed active agents alternate console poses with visible animated circuits in
their own work areas. Idle agents dock, queued agents wait along the ingress path,
and state changes use smooth travel rather than jumps. These paths visualize
activity, not literal location, detailed work, communication or job completion.
Unknown/stale observations freeze exact current positions. Reduced-motion,
backgrounding, lightweight rendering, zoom and exact-recipient taps are retained.

## Public speech bubbles and graphics, 0.2.7

Environment keeps its overhead view and activity paths, with a modern shaded hull,
curved workstations and smooth creature surfaces. Static scenery and sprites are
cached; lightweight rendering, reduced motion and stale-state freezing remain.
Six tappable speech bubbles use only the current session's public assistant report.
Older reports carry an explicit last-report label; no-report states are not quotes.
Unobserved/offline state withholds report previews. Tap opens the corresponding chat
without sending. Bubbles use safe DOM text and collision-aware placement around
creature silhouettes, with connectors tracking movement. Compact previews retain
a readable line at enlarged Android/app text sizes; the room scrolls naturally
when it needs more height. An impossible packing hides bubbles with an explicit
zoom-out notice rather than covering creatures. Android font changes update the
layout without needing an app reload.

## Fresh reply audio (0.2.8)

The local reply-speech helper serializes only authenticated fresh finals in the open
chat. Native playback generations fence delayed downloads and audio-focus callbacks;
completion emits one terminal event rather than stopped followed by ended. Speech
uses pinned authenticated downloads and the approved host voice; no system TTS.
Pause, disconnect and recipient changes cancel playback without reconnect replay.
