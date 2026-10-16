# Watch 0.4.0/code24 — real spatial scene and native timeline

Published through the existing authenticated private updater. No forced install.

- Watch program source: `6d15c4c9eb41d09e01a70817f16a32ca793f46d9`.
- Telegram fork source: `0f006c8d529a202e7ee5e9fbf2981a6938d0bbf8`,
  branch `integration/atlas-watch-3412`, pushed without force.
- Paired APK SHA256 `90fb945b36d14e3f8d6da1375a3a3fbf62833174bfc2507edd162e00eccea234`;
  1,511,302 bytes. Original signer
  `8579d7acc91dc2d4cc185d0624160e5f7fb8c862db034be00af84e5f195eddc2`.
- Tested unpaired APK `3b0bbdcb48ae7d7d1707d965a9d9545a60ac45b11cff8ade42177cd0322e0157`.
  All 88 non-private program/resource entries match; only the private profile differs.
- Signed 0.3.4/code23 remains intact. Authenticated manifest, pinned-TLS APK
  download/hash/signer, and unauthenticated rejection checked. Profile/TLS unchanged.
- Watch backend PID 140904 before/after; serving file hashes unchanged. Neither
  Watch nor shared gateway restarted. No production input, live Stop/Steer/hold
  release or old audio used. Six feeds available in publication read, not proof
  of peer productivity or handset use.

## Experience

See [SPATIAL-040.md](SPATIAL-040.md) for implementation and limits.
Perspective WebGL cutaway, movable camera, original six creatures/stations,
retained inspection dock; native RecyclerView conversation/Activity with actual
Telegram SmoothScroller, fine-grained updates and exact-session swipe-to-reply.
The fixed navigation's measured height now protects inspection actions at enlarged
Android text sizes. Camera tools have their own rail, not overlays over creatures.

## Verification

- Browser: 16 actual scene/camera/update/context-loss/fallback checks; 35 affected
  manual audio, scaling, Activity, original-detail and debugger cases. 71 pure
  idle/public attribution/pin/speech/status checks pass.
- Android: real WebGL and injected touch orbit; snapshots preserve camera/static
  mesh/dock; station inspect and exact chat navigation; action reachability.
  Final 13 checks per orientation with actual portrait/landscape geometry asserted,
  Android font150%, 1440x3120/3120x1440. Screenshots are synthetic/unpaired.
- Native timeline: 41 reuse/anchor/revision/session checks; five real swipe and
  SmoothScroller checks including physical-session replacement mid-gesture.
  Hold recovery real native/WebView bridge14. Full surface275 on same native DEX.
- Graphics CPU/RAF debugger samples are bounded; these are NOT GPU frame
  presentation or physical-phone perceived smoothness measurements.
- Initial dependency/detach crash, test-orientation mistake and enlarged-navigation
  overlap were found and corrected before publication. Old floating-overlay
  integration fixtures are superseded by dock/3D checks, not falsely called green.
  Five existing broad browser-suite failures remain explicitly unresolved.

Private ignored evidence: `mobile/runtime/spatial-040-20261016/` including
`ANDROID-VERIFICATION.json`, browser-result, parity and serving-update-verified.

## Still unfinished

Physical handset installation/usability and genuine live-control acceptance.
Full Telegram ChatActivity/ChatMessageCell/composer parity. Fully volumetric agent
models (original artwork is currently billboarded). Upstream missing citation,
nested-event coverage and exact execution evidence remain separate. This release
is a substantial spatial/native step, not a claim that the entire original vision
has been completed or accepted.
