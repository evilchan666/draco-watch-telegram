# Watch 0.5.0/code26 — first-person operating Environment

Published through the existing private updater after Cas's explicit clarification:
Environment is the main fullscreen operating space, with a local first-person
avatar, controls and full agent communication. The rejected 0.4.1 overview is
preserved, not treated as the acceptance target.

## Exact custody

- Packaged Watch program source `e7ecffbad087328a58dfaf281c0d8408dc2c225e`;
  packaged actual Telegram fork `edaec9e912a4bb90f84a213bf6797a69562177d4`.
- Final Android harness source `9e22999cc1d22400c1d0bafeb4a9207718f6d9aa`,
  fork `4a65d081df6ba69441702d0c468035de2f7dc53d`; subsequent difference is
  test-only scrolling/failure capture, not packaged program bytes.
- Paired APK `dce39fc5f2a621eec7460c9a3da1d5c4469d7471b44bbfda7d7c1ad708fb8534`,
  1,523,590 bytes. Tested unpaired APK
  `928ba575e97f45ba8c0e0d646efe9829f4d7b621ee3be91fb019cecc17462671`.
- All 88 non-private program/resource entries match. Original signer
  `8579d7acc91dc2d4cc185d0624160e5f7fb8c862db034be00af84e5f195eddc2`
  and exact previous pairing preserved. The paired APK was never installed into
  the test emulator.
- Authenticated pinned-TLS manifest and full APK download/hash/signer verified;
  unauthenticated manifest rejected401. Immutable 0.4.1 APK remains hash-verified.
  Watch PID140904 unchanged; neither service restarted by this work.

## Implemented

See [scope](FIRST-PERSON-050.md) and [controls](GUIDE-050.md). Environment is home,
not a miniature dashboard. Human-scale walk/strafe, independent drag-look, eye
height, bounded console/wall collision and local hand/wrist artwork. Reticle/tap
selects an exact agent; Talk uses the existing full native conversation and its
files/voice, pins, commands, audio, work and supported run-control paths. Back
preserves the in-memory world pose. Menus/background/chat stop held movement.

The world draws edge to edge under the cutout while HUD controls remain safe.
Native chat/IME retain normal margins and chrome. A real Android immersive-
education/focus feedback loop was found and fixed: transient focus changes stop
world activity but do not restore/hide bars repeatedly; actual world/chat/IME/
lifecycle transitions own chrome restoration.

## Connection evidence, not an invented handset diagnosis

Repaired the reproduced physical-session capability-cache rollover and reject
late responses for old/disconnected sessions. Preserve `connecting` instead of
falsely reporting it as failure/offline. Native snapshot diagnostics now retain
bounded status/class/duration/correlation, never credentials or exception prose.
Healthy relay reads do not prove phone connectivity. The exact reported S25
transport failure remains unconfirmed; no speculative profile reset, TLS change,
uncertain-input retry or old audio replay was performed.

## Verification and limitations

Ignored private evidence: `mobile/runtime/world-042-20261016/`.

- Final actual unpaired Android world47 checks: portrait and true landscape,
  native150% font plus app150%, real touch walking/look, full native conversation
  controls and exact-pose Back, menu/Settings chrome. Both screenshot pixel sets
  25/25 nonblack; WebView/decor1440x3120 and3120x1440, all native margins0. Root
  inspected both final images. This is not physical S25 acceptance.
- Native core85 pass on final source; retained native surface275 pass before
  only the focus-eligibility correction (the final world run covers that path).
- Browser88, capability rollover11, navigation/collision14, engine context/
  resize/fallback probes, manual-audio/debugger35 and custody/pins/reply52 pass.
  Native-only focus correction does not change browser assets.
- Failed runs retained: original focus loop; one shared ADB disconnect; a harness
  offscreen tap in a scrollable large-text landscape menu. Final harness scrolls
  to the button and uses real Android touch; it does not replace the action with
  a JS click. An isolated ADB server avoided interference from shared tooling.
- Older fallback-DOM conversation fixture fails on both preserved and current
  source while native payload has its expected rows. Five historical broad
  fixture failures remain open; no full-suite-green claim.
- No production message/control POST, synthesis/playback, gateway restart,
  scheduler/peer relay or forced phone installation. Owned emulator5558 and
  isolated ADB server were stopped; emulator absence verified.

Local hands are UI artwork and creatures remain billboard artwork, not a networked
or volumetric avatar rig. Full Telegram chat-stack parity, physical phone
connection, perceived visual quality, sustained handset FPS and acceptance remain
unverified or unfinished. Do not mark the entire original outcome complete.
