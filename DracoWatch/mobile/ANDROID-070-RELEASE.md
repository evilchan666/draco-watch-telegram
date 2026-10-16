# Watch 0.7.0/code28 — retained-world conversation

**Published 0.7.0/code28.** Authenticated manifest and complete APK download verified at 2026-10-16T11:36:30.568931+00:00. Physical installation/acceptance remains unverified.

0x rejected 0.6's unchanged operating experience and instructed ATLAS to correct
the product, not its appearance. This change addresses the concrete interaction
failure: Talk no longer removes the environment to open a separate screen.
It does not claim that the whole original product is finished.

## Implemented interaction

- The full existing native conversation docks below the world in portrait or
  alongside it in landscape. The original world/camera survives reading,
  conversation expansion, the real keyboard and Android Back.
- One persistent contact strip changes the exact recipient. Separate drafts
  survive switching. Re-selecting the current recipient preserves search,
  reply and reading context. Explore explicitly restores movement; otherwise
  typing/reading cannot walk or turn the player.
- Native review covers draft text, staged files, reply references and original
  pending/uncertain requests. File removal is guarded against unresolved owners;
  retry eligibility is freshly checked and preserves the original request ID.
  Routine review no longer routes to the legacy composer.
- Reply clearing validates the exact message ID, not a truncated label. A late
  admission acknowledgement cannot clear a subsequently selected reply.
- Constrained landscape IME uses the same native editor, recipient and action
  controls at full safe width. Timeline widgets are retained and restored when
  the keyboard closes. User font settings are not reduced to pass a check.
- HTML full-report/advanced fallbacks retain world ownership independently of
  native-panel visibility. Native conversation notices are not duplicated as
  oversized WebView overlays behind the panel.

No transport, pairing, gateway policy, login, replay or live control changes.
Room geometry is unchanged. See [the interaction guide](GUIDE-070.md).

## Checks actually run

All Android checks used an isolated, deliberately unpaired emulator. Recipient
history, admissions, file and recorder results were synthetic. The real Activity,
native conversation tree, WebView, keyboard, configuration and screenshots were
exercised. No live message/Stop/Queue, microphone capture or device acceptance is
inferred from fixture callbacks.

- Packaged Android workspace: **714 passed**, native/system font150 plus app150,
  portrait/landscape, all six recipients, real keyboard, expand/collapse/Back,
  exact draft/session/run actions and unchanged position/look.
- Native draft/file/reply/outbox dialogs: **90 passed**, including stale
  callbacks, locked files, original-ID eligibility and exact reply identity.
- Native core: **89 passed**. Existing native surface/dialog suite: **276 passed**.
- Integrated browser workflow: **60 passed**, no script errors or external
  requests. Includes late acknowledgement, distinct drafts, stale controls,
  retained-world fallback and duplicate-notice regression.
- Existing world/Operations browser checks: **191 passed**. Focused local custody
  and status tests: **42 passed**. This is not an all-suite-green claim; historical
  broad fixture failures are not silently waived.
- Root reviewed rendered Android portrait, landscape and constrained keyboard.
  The installed unpaired APK equals the preserved tested artifact byte-for-byte.

### Failed attempts and corrections

The first enlarged-editor assertion incorrectly assumed linear SP conversion;
it was corrected to Android's actual API35 nonlinear conversion. An invalid
synthetic conversation key then correctly prevented Stop admission; the fixture
now uses canonical identities, without weakening the product fence.

Actual landscape IME checks failed at498 because the header crowded out the
editor; the constrained mode above repairs it. The next run failed at509 for a
missing editor recipient accessibility label; that label was added. Both final
714-check runs passed. A browser acknowledgement assertion sampled an old native
render; the final check explicitly waits for the returned acknowledgement and
fresh composer payload before checking reply custody.

One191-check rerun omitted its output override and used the historical working
checkout's `hour-060-20261016/operations` default. Those new files were copied into
the current evidence directory and marked with `PROVENANCE-CORRECTION.json`;
they must not be mistaken for0.6 evidence. Separate0.6 `final-operations` evidence
and the published package were not changed.

## Provenance and limits

Program/test Watch source: `99e3dfd` (program change ends at `4a1d8c2`).
Actual Telegram fork module contains matching tracked source; no lookalike repo
or Telegram service/login migration was substituted. Package hash, source commit,
original signer/pairing parity, service PID and authenticated updater download are
recorded separately in the ignored `mobile/runtime/workspace-070-20261016`.

Physical S25 connectivity/installation/smoothness, full upstream Telegram-stack
parity, networked avatar rig and broader product acceptance remain unverified or
unfinished. Host updater success is not proof of phone reachability. No gateway
or Watch service restart and no forced handset installation are part of this work.

## Published package

- Watch program/test source: `99e3dfd762b2cff156ddddd2ab5c6b10413403a8`.
- Packaged actual fork source: `14040179383f6ea252b18c351638826ca9d3720c`.
- Paired APK SHA256: `2fc9080ccc53582f47423569dce411d73b5a3c47c967758d2129110331684dad` (1544070 bytes).
- Tested installed unpaired SHA256: `0ae368f7d8f259a9fad9c439db10b357bae070fe1e674423f8840fcccf822363`.
- All 88 nonprivate entries and all 8 bundled UI assets match; original pairing values and signer are preserved.
- Host manifest/download200, normal hostname verification, certificate pin and signer all match. Unauthenticated manifest401. Immutable0.6.0 package unchanged. WatchPID140904 unchanged; no service restart.
