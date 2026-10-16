# Watch 0.4.1 — Environment correction after handset evidence

The operator's physical S25 Ultra screenshot of 0.4.0 showed a cropped room at
255% zoom, small flattened creatures, primitive block stations, oversized camera
chrome, four visible agent chips out of six, and unused screen space. Publishing
0.4.0 did not establish a useful handset composition. This is the correction to
those concrete failures, not a claim of full Telegram parity or a complete 3D world.

## Changed experience

- The scene uses the available phone height, with all six agent destinations in
  a compact two-row grid. Each has an explicit occupancy label; occupancy is not
  productive execution. The selected identity and conversation/work actions stay
  anchored. A labelled Read action opens a full-height, scrollable observation
  reader when enlarged landscape text cannot leave a readable inline preview.
  It closes on identity/session replacement and respects preview off, expiry and
  disconnected state; it does not recover old speech through the back door.
  Short, system-inset landscape layouts remove the old 300px minimum and repeat
  only the selected world label. All six named selectors remain reachable;
  their full occupancy labels remain accessible and the selected phase stays
  visible. This avoids overlapping world labels and navigation, not smaller text.
- Overview projects the hull, observation window, full creature artwork and
  labels into the actual canvas aspect. Pinch zoom and pan are bounded. An
  intentional Focus is separate and survives zoom; Overview resets it. Refreshes
  do not reset the camera, change the selected agent or repack text.
- Six rounded dark station pods, beveled deck, inset instruments, directional
  shading, contact shadows and observation glass replace saturated slab desks.
  Original distinct artwork faces the camera rather than flattening at an angle.
- A small Overview/Camera rail replaces the six-button rail. Zoom, Focus and the
  saved report-preview switch remain available in explicitly opened Camera tools.
- One retained WebGL mesh, cached art and a single visibility-aware frame loop
  remain. Software compatibility mode caches the static architecture and limits
  animation to 15 fps; this is a target, not a measured phone frame rate.
- Required repaints survive the frame limiter. A real Android screenshot caught
  an empty black canvas under retained HTML labels after selecting an agent.
  The trace showed a backing-store resize immediately after the last draw, with
  no subsequent paint and no WebGL error/context loss. A separate idle/light-mode
  browser probe reproduced the same dropped repaint. Dirty redraws now retry
  across the frame cap and settle once painted, without starting idle animation.
  This is a diagnosed rendering defect, not evidence that every handset stall
  has the same cause. Debugger scene metadata includes pending paint/frame state.

## Preserved

Exact-session reports/pins, sixty-second idle preview expiry, unknown-state freeze,
saved manual preview preference, chat/history, RecyclerView/swipe behavior,
draft/outbox and control custody, approved manual audio, debugger, pairing, signer
and update path. No production input, old recording or live control is used as a
test. No Watch backend or shared gateway change/restart is part of this correction.

## Verification boundaries

Use the dedicated S25-sized browser fixture for all-six-target reachability,
portrait/landscape enlarged text, camera gestures, refresh/session replacement,
expiry and disconnected state. Sustained-motion/context-loss/software checks are
separate. Android checks must assert actual orientation and initially visible
actions; scrolling the page to make an assertion pass would miss the reported
failure. Numerical reachability checks alone also missed the blank canvas;
actual screenshot pixels after resize/selection/reader navigation are a separate
release check. Evidence belongs under ignored `mobile/runtime/spatial-041-20261016/`,
never over the preserved 0.4.0 evidence.

Original creatures are still billboard artwork, not fully volumetric models.
Physical S25 composition, responsiveness and usability require handset evidence;
synthetic Chromium and Android-emulator checks are not operator acceptance. The
five previously documented broad browser failures remain open.
