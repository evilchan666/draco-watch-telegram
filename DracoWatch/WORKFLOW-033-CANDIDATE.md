# Watch 0.3.3-workflow / code 22 — private candidate

This isolated composition starts at the actual Telegram fork commit
`59229ad3093c95718916ed5cad24b89df0a24cea`. The corresponding Watch source is
`bdc0eaa3784087ef2e27247eb9b728cbcd0cc8bf`. Three bounded source copies carry
the workflow interface into the existing native module:

- `mobile/ui/app.js`
- `mobile/ui/client-state.js`
- `mobile/android/src/org/omega/dracowatch/TelegramSurface.java`

The module manifest identifies the private candidate as version
`0.3.3-workflow`, code `22`. Existing Telegram-derived components, attribution,
licenses, eight bundled UI assets, application identity, voice, Environment,
Chamber, pairing, and Android build/signing workflow are retained.
`SOURCE.json` and the 0.3.2 release records preserve the earlier release evidence.

The gateway supplies current phase observations and an explicit durable-stop
capability. The native Stop label reads `can.durableStop`: **Stop & hold** when
available, **Abort run** otherwise. Native actions retain the captured physical
session and run. A retained hold preserves its original issuance session while
the gateway attests its current canonical session. Missing or conflicting current
bindings remain unavailable. Process cessation requires separate evidence.

The private build uses the existing `mobile/android/build.sh`, an explicitly
absent `DRACO_PROFILE`, and the existing Android debug signer. Its APK contains
no bundled pairing profile. Package identity, all eight packaged UI hashes,
source-copy hashes, and signer continuity are recorded in ignored
`mobile/android/build/workflow-033/verification.json`.

Packaging does not publish an updater, install an application, activate a
backend, release the fleet hold, or establish physical-phone acceptance.
