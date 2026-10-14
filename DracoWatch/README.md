# DRACO Watch native Telegram integration

This standalone Android module is part of the actual draco-watch-telegram fork.
It reuses the fork's genuine Telegram message-bubble path, animated pinned-line,
back-navigation and enter-top components. See
[component provenance](mobile/android/TELEGRAM-PROVENANCE.md) for exact originals,
license, adaptations and limits. It is not a Telegram service/login migration and
is not a claim of full Telegram ChatActivity or ChatMessageCell parity.

Watch's existing authenticated backend, capabilities, exact-session/run controls,
durable drafts/outbox, attachment pipeline and approved per-agent speech remain
the transport and custody authority. Chat, agent roster, pins and execution stream
are native; Chamber, Environment and Settings retain their existing bundled views.
Advanced dialogs temporarily reveal the retained bundled UI, rather than losing
working controls. Pins are device-local, exact physical-session snapshots, not
Telegram server pins. Only admitted public reports and owner-bound operational
facts enter this renderer; private reasoning and raw tool payloads do not.

## Build the unpaired candidate

From this directory run `bash mobile/android/build.sh`. It uses Android SDK35
build-tools35.0.0 and a Java21 JDK; override DRACO_ANDROID_SDK/DRACO_JDK as needed.
No Telegram API key, Firebase, network dependency resolution or Telegram login is
needed. A private profile may be supplied through DRACO_PROFILE; never commit it
or the resulting paired APK. Use the existing signing identity for upgrades.
SOURCE.json pins the Watch source and Telegram base. Generated output stays under
ignored build/runtime directories. The integrated APK is not yet live by virtue
of a successful build; real handset acceptance must be recorded separately.
