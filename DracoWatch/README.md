# DRACO Watch native Telegram integration

This module lives in the actual draco-watch-telegram fork. It retains the genuine
Telegram-derived message-bubble, pinned-line, back-navigation and enter-top
components. See [component provenance](mobile/android/TELEGRAM-PROVENANCE.md).
It is a bounded native component integration, not a Telegram login/transport
migration or full Telegram ChatActivity parity. Watch's authenticated backend,
original black/red identity, per-agent accents and existing spatial views remain.

## 0.7.0 retained-world workspace

The full existing native conversation is now a panel inside the first-person
workspace: bottom-docked in portrait, alongside the world in landscape. Text,
voice/file preparation, replies, pins and supported exact-run actions retain
their existing authenticated session and original-request custody. Native
draft/file/outbox review no longer sends routine work to a second composer.
Movement is explicitly paused while communicating; Explore restores it.

0.7.0/code28 is published to the authenticated private updater. See [release evidence](mobile/ANDROID-070-RELEASE.md) and [the interaction guide](mobile/GUIDE-070.md). SOURCE.json records the exact
Watch source, packaging/publication state and preserved 0.6.0 baseline. Android
fixture results do not establish physical S25 connectivity or acceptance. This
does not claim full upstream Telegram chat-stack parity or change room geometry.

## Historical 0.3.2 record

0.3.2/code21 is published to the authenticated private updater. Phone installation
and usability remain unverified. See the [full version guide](GUIDE-032.md),
[release evidence](ANDROID-032-RELEASE.md) and [owned work record](ANDROID-032-WORK.md).
Chat is compact; audio defaults to manual, with exact-report pause/resume/seek/Stop.
Activity follows the live edge, preserves scrollback and offers owner-record
inspection through exact authenticated source/revision retrieval. Support diagnostics
include private metadata/crash journals and JSON export. Local WebView inspection
requires explicit Android consent and turns off in the background.

Retained owner tool originals are read separately from concise public summaries;
no model reasoning is reconstructed. Missing producer media/text bindings and host
exact-run Steer remain explicit gaps, not fabricated outcomes or Queue substitution.

SOURCE.json records exact Watch source and preserved0.3.1 baseline. Package,
serving backend/updater, installation and physical acceptance are separate stages.
The historical REQUEST-CHRONOLOGY-3474.md describes an earlier source-only handoff;
its then-open package/Android states are not the current release evidence.

## Build

Run `bash mobile/android/build.sh` here. AndroidSDK35/build-tools35.0.0 and Java21
are used; DRACO_ANDROID_SDK/DRACO_JDK can override their locations. No Telegram API
key, Firebase, dependency download or Telegram login is needed. A private profile
may be supplied via DRACO_PROFILE; never commit it or the paired APK. Upgrades
retain the original signer. GPL notices and corresponding source remain included.
Generated output stays ignored. Successful build is not handset acceptance.
