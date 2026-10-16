# Watch 0.4.1/code25 — S25 Environment correction

Published through the existing authenticated private updater; no forced install.
This follows the operator's actual S25 Ultra screenshot of 0.4.0, not a claim that
0.4.0's synthetic checks proved satisfactory phone appearance.

- Watch source `8d2791fb57e0ea585c6309267a2847be1ca4540e`; actual Telegram fork `42e5ddd01e8133da35d4deaf6a6b8838e9444156`.
- Signed paired APK SHA256 `e1561b3fa29fdaf95083777526356e7a1a06260058fcda82031bdb032835d4f3`; 1,515,398 bytes.
- Original signer `8579d7acc91dc2d4cc185d0624160e5f7fb8c862db034be00af84e5f195eddc2` and pairing retained.
- Tested unpaired APK `94b279ee92b266be4d67bdb2978b63849cde1d444230a8ea49ddec1bac554af3`. All 88
  non-private program/resource entries match the paired APK; only the profile
  differs. The paired APK was not installed into the test emulator.
- Authenticated pinned-TLS manifest, complete APK download/hash/signer and
  unauthenticated rejection verified. Signed 0.4.0 remains intact/recoverable.
- Watch backend PID 140904 before/after and relevant serving source
  hashes unchanged. Neither service restarted by this work. No production input,
  live control, old audio, synthesis, scheduler or peer relay used as a test.

## Correction

Aspect-fitted six-station overview and bounded camera; rounded shaded deck and
pods; correctly camera-facing original creature art. All six named destinations
are reachable, with compact Overview/Camera controls. Exact-session inspection
has a full observation reader rather than forcing long text into a narrow slit.
Actual short/inset landscape removes a hard minimum that overlapped navigation,
with compact Chat & pins/Work labels and one selected world label; full destinations
and accessible names remain. See [guide](GUIDE-041.md) and [scope](S25-CORRECTION-041.md).

## Rendering failure found and repaired before release

Numerical Android reachability checks initially passed while a later screenshot
showed a black scene under retained HTML labels. Native trace proved: a backing
resize followed the last draw within1ms, with no later paint; GL error0, context
intact. Independent light30fps/all-idle browser reproduction produced99.11% black.
The frame limiter had discarded the only required paint when ambient animation
was off. Required dirty paints now survive the cap, drain after rendering and do
not create an idle loop. The same reproduction now repaints automatically.

## Evidence and limits

Private ignored evidence: `mobile/runtime/spatial-041-20261016/`.

- Dedicated geometry/interaction browser fixture138 checks across eight viewport,
  app/system-scale profiles; trusted six-agent targeting, orbit/pinch, reader,
  expiry/manual-off, disconnect and physical-session replacement. Geometry run
  preceded only the frame-retry change; its source hashes remain in its record.
- Final corrected Android APK25 checks per actual portrait/landscape at150% system
  font. Includes four real screenshot-pixel checks in each orientation: overview,
  reader close, orbit/update and selection-triggered resize. Normal checks do not
  use heavy per-draw GL tracing, forced recovery, hidden source or live accounts.
  Root visually reviewed corrected portrait and short landscape screenshots.
- Final scene suite19/19: sustained updates, context loss/recovery, software
  fallback, plus real30fps all-idle reduced-motion screenshot regression and
  settled repaint with no continuing idle RAF. Zero script errors.
- Reader/idle pure policies25 pass; affected manual-audio/debugger browser35 pass.
  Existing native timeline/audio/control program remains unchanged. Five historic
  broad browser-suite failures remain open, not relabelled as a full green suite.
- The owned unpaired/network-disabled emulator was stopped; absence verified.

Physical S25 installation, appearance, responsiveness and operator acceptance
remain **unverified**. No measured handset FPS/energy saving is claimed. Original
creatures are still detailed billboard artwork, not volumetric models. Full
Telegram ChatActivity/ChatMessageCell/composer parity and producer evidence gaps
remain unfinished; this is the bounded handset correction, not completion of the
entire original vision.
