# Watch: requested experience versus delivered implementation

ATLAS, 16 October 2026. Direct Cas1835/1840: investigate the primitive spatial
view, flashing reports, update jank, inadequate use of Telegram and my own
failure to deliver the requested experience. This is the current correction,
not a replacement for the unfinished original assignment.

## Finding

**The discrepancy is architectural and behavioral, not merely cosmetic.** I
delivered a small Telegram-derived component integration around my own chat
implementation, plus a top-down canvas room. I then optimized some chat update
paths without addressing Environment. Those changes were real, but did not
establish the smooth, spatial operational application Cas asked for.

The implementation is not worthless: custody, original-record access, manual
audio, pin history, recovery and exact-target guards are substantial retained
work. Their existence does not make the missing experience complete.

## Inspected boundary

- Owned branch `integration/atlas-telegram-3412`, initially clean at `bf32488`.
- Real Telegram fork `integration/atlas-watch-3412`, initially clean at `8a19cfd`.
- Published 0.3.4/code23 APK: SHA256
  `00ca402487641b5b4186e1fc0f7c451bd6a461e32cad5b452dba890f4aecfdc0`.
- Program source `4a46415cd20344d55955d2dee748c66a5ed29210`; actual fork
  `fb78bf566a9421b06d05ec1c5c760aa5589c6557`.
- Watch backend PID140904 was active; updater still served code23 at inspection.
- No current handset version or fresh handset trace was observed. Cas's report
  is direct usability evidence, not a measured attribution to a particular APK.

## Requirements reconciliation

| Requested outcome | Actual implementation/evidence | Disposition |
| --- | --- | --- |
| Use Telegram's mature native interaction, not a lookalike | Five real derived components: enter-top container, pin indicator, message shape, back drawable, easing. Chat uses my Android ListView/BaseAdapter, composer and state orchestration. ChatActivityEnterView, ChatMessageCell and RecyclerListView are not integrated. | **Original integration outcome incomplete.** Fork location and provenance do not prove interaction parity. |
| Richer spatial Environment with retained distinct creatures | Orthographic Canvas2D floor plan, pan/zoom, six sprite identities, occupancy paths and HTML report cards. No depth-aware scene, orbit camera or spatial work inspection. Every room target opens chat. | **Spatial outcome not delivered.** Current scene is an interim view. |
| Fluid app, not repeated update disturbance | 0.3.4 batches native visual publication, reuses rows and skips hidden rich work. Environment files were not changed by that release. Whole snapshots still update roster/spatial presentation. | **Whole-app smoothness unproved and operator-rejected.** |
| Stable live reports | Repeated fitting follows moving actors; forced snapshot layouts can reopen list-vs-overlay placement. Unknown status, lost observation, source availability and intentional idle expiry also change presentation. | One oscillation is reproduced below. Other causes require exact traces; do not join them by assumption. |
| Recognizable black/red identity and agent accents | Restored after I initially introduced incompatible colors. Existing assets and identity retained. | Implemented, not a substitute for depth or quality. |
| Compact readable chat and stable scaling | Native compact work row, hidden idle player, fallback composer and earlier scaling corrections exist. Native and WebView remain separate layout/scroll systems. | Partial; fit assertions do not establish fluid cross-surface transitions. |
| Pin/unpin/history/navigation and useful live work | Device-local session-bound pins, history/navigation, chronological Activity and follow/scrollback; public authored checklist projection. | Implemented paths; not cross-device pin synchronization or independent task-execution proof. |
| Owner can inspect recorded commands/scripts/results | Compact operational projection plus authenticated, revision-bound, paged original-record inspection/export. | Preserve. Original detail is not the same as complete inline producer coverage. Missing records/nested events/citation resolver remain explicit. |
| Deliberate audio with readable text, correct report association, rates and music | Manual-first playback, exact report/session binding, six rates, seek/pause/Stop and cooperative audio checks. | Preserve. Fresh correct-app text/optional audio and physical audibility/music acceptance are not established; producer voice-only failures remain distinct. |
| Dependable Stop/Steer and recovery | 0.3.3 consumer uses advertised exact-target capabilities, separates Stop/hold/release and original uncertain send IDs. | Preserve. Capability/receipt support is not fresh handset control acceptance. Missing exact targets must stay unavailable. |
| Files, commands, replies, drafts/outbox, pairing/updater | Retained via native and advanced WebView paths, original signer/profile and request-ID custody. | Preserve; five broad baseline test failures are still unresolved, not waived because old. |
| Debugger that reduces operator troubleshooting burden | Crash/request/navigation/scale/player metadata and support export exist. No Environment frame/layout history in the published package. | Candidate adds bounded Environment timing/layout diagnostics; not yet packaged or on the phone. |

Sources: `android/TELEGRAM-PROVENANCE.md`, `ui/environment.js`,
`ui/environment-bubbles.js`, `ui/app.js`, `ANDROID-034-RELEASE.md`,
`REQUIREMENTS.md`, `REQUEST-CHRONOLOGY-3474.md`, `DEFECT-INVENTORY-3474.md`, and
the preserved `staging/watch-next-20261015-1737/NEXT-VERSION.md` in my workspace.
Older ledger/status sections contain superseded states; they are historical
evidence, not the current product state summarized here.

## Reproduction and causal limits

Isolated real Chromium/app source, synthetic public reports/native transport,
six active creatures. No live input, original audio, gateway or private profile.

1. **Unchanged reports and fixed camera:** advance 600 motion frames of 50ms,
   forcing layout every 60 frames to represent the three-second snapshot cadence.
   At 360x712 CSS viewport the original switched overlay/list mode three times;
   at 412x816 it switched five times. No report or agent identity changed.
   The limited/list branch was sticky for animation frames but NOT for forced
   snapshot layout. This repeatedly reparented the report layer in normal app
   flow as moving bodies changed the packing result. That is a reproducible
   structural jump mechanism, not just a subjective animation complaint.
2. **Repeated unchanged viewport notifications:** the original assigned canvas
   width/height on every resize call, even unchanged. Each assignment discards
   the backing store/context state. Thirty redundant fit calls add sixty such
   assignments. That is avoidable work; the fixture does not prove each caused a
   visible black flash on Cas's phone.
3. **Wall-clock steady fixture:** 40 updates over approximately ten seconds did
   not produce card visibility changes at 412x816 in the initial run. A healthy
   synthetic stream alone is insufficient to reproduce all reported flashing.
   Offline/partial coverage, idle expiry, session changes and real device frame
   scheduling are separate candidate causes, not proven explanations.

Ignored original evidence: `runtime/environment-investigation-20261016/`:
`before.png`, `before.json`, `motion-before.json`, exact probe scripts and later
after results. Wall-clock RAF samples on this headless host are not phone FPS.
The first probe's Chromium-profile cleanup raced process exit (ENOTEMPTY);
subsequent probes wait for exit and clean up. The measurement completed before
that harness error; it is not an app failure.

## My contribution to the failure

- I silently narrowed a whole-product request into tractable component tasks.
  The extraction was honestly documented in provenance, but I did not keep the
  unfulfilled integration objective prominent in product delivery.
- I treated preservation and functional checks as the main release bar. They
  protected important behavior but did not assess spatial coherence, continuous
  motion/update/navigation or the experience Cas was actually rejecting.
- I titled 0.3.4 a smoothing release after optimizing selected paths, while
  Environment was untouched. A phone-unverified footnote did not close that gap.
- I allowed a configured frame-rate target to be presented as “Smooth mode.”
  That describes an intention, not measured smoothness.
- I accumulated chronological ledgers with stale current-state claims instead
  of maintaining one clear requirements-to-working-product map. Component
  milestones, test counts and publication repeatedly displaced the original
  useful-app outcome. That is my execution failure, not evidence that Cas failed
  to explain what he wanted.

## Targeted repair already made in source

Not a spatial redesign or release: preserve a settled list until real geometry,
camera, text scale or visible-report identities change; unchanged canvas sizes
do not reset the backing store; reopening still draws. Replace “Smooth mode”
with an explicitly unmeasured drawing target. Add bounded Environment CPU-draw /
RAF interval, resize and report-layout counters to the existing debugger export.
No timer, automatic transcript capture, gateway request or playback is added by
the spatial diagnostics. CPU time is not GPU presentation/native-chat timing.

`ui/tests/environment-continuity-check.mjs` exercises sustained motion, repeated
fit callbacks and genuine resolution/camera changes. Existing responsive and
idle-expiry checks remain relevant. Result details are recorded after execution;
source checks alone do not establish Android package or phone acceptance.

Verified result on this source: six new continuity/diagnostic checks pass;
existing responsive Environment 141, idle-expiry 15 and manual-audio/debugger 35
checks pass. Across the five motion profiles the candidate's mode transitions
are 0/1/0/0/0 rather than baseline 0/3/5/0/0. A transition into the readable
fallback can still occur; repeated switching back is prevented. The controlled
unchanged-viewport probe now records zero backing-store assignments. These are
isolated Chromium results, not new Android/runtime/phone verification. The five
previously documented broad baseline failures were not rerun or closed.

No version bump, APK build, updater mutation, service restart, live control,
historical replay or device install accompanies this investigation. Code23 stays
published. This is a diagnosed source repair and correction of the delivery map,
not an automatic release gate or a claim that the full app has been rebuilt.

## Required continuation — not another room reskin

1. **Retained spatial scene:** real world coordinates/depth, camera transform,
   stable landmarks and object selection. Preserve the ship/creatures/identity,
   but replace screen-space packing as the organizing mechanism. Updates modify
   existing entities, not scene membership/layout on every poll. Camera and user
   focus survive updates. Report text stays readable in a stable inspection
   surface; six agents' reports remain reachable without covering their bodies.
   Movement remains an illustration, never invented productivity.
2. **Native interaction foundation:** stop describing the five-component subset
   as the mature Telegram stack. Establish the actual native timeline/composer,
   scroll-anchor, gesture/keyboard and update-animation integration boundary in
   the real fork, with explicit gateway-domain adapters. No Telegram login/service
   migration, fake successful model stubs or replacement of custody/control logic.
   Dependency size explains the unfinished work; it does not satisfy the request.
3. **Evidence-led acceptance:** sustained updates + camera/selection + navigation
   + keyboard + audio/manual silence + disconnect/reconnect on a reproducible
   candidate. Capture real frame/layout traces and before/after recordings, not
   only screenshots or fixed geometry tests. Use device-debugger observations to
   separate projection changes from renderer/transport/producer faults.
4. **Close existing gaps:** diagnose the five retained broad test failures; keep
   fresh device control and readable text/media acceptance separate from source,
   emulator, updater and receipt success. No replay to manufacture those proofs.

Preserve current release/candidates, original signing/pairing/profile, drafts,
request custody, public/private separation, exact-run controls, approved voices,
pins/history, six distinct identities, Chamber and original assets. Shared
gateway/other agents' work is not a target of this repair. Language choice is
not itself the defect: my implementation and verification choices are.
