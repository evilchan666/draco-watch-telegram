# Watch 0.4.0 — spatial scene and native timeline

## Implemented, not a reskin

- The flat orthographic room is replaced by a retained perspective ship interior:
  actual WebGL meshes, depth-tested consoles/raised bays, railings, bridge windows,
  original agent artwork rendered as billboards, and a movable camera.
- Drag to orbit; pinch to zoom/pan; Fit resets and Focus targets the selected
  creature. Keyboard arrows/+/−/0 remain available. Stations and creatures select
  the inspection dock, not an involuntary conversation jump.
- One dock retains exact-session public report preview, execution evidence state,
  and pins. Conversation and Work details are explicit actions. No animated
  screen-space report packing, movement-driven list/overlay switching, or
  per-frame text measurement. Landscape gets a bounded independently scrollable
  inspection pane; the camera controls never overlap the scene.
- Unknown/disconnected freezes illustrative motion; reduced motion and hidden
  views stop animation. An open run is not labelled productive work. Manual
  report preview preference and sixty-second idle expiry remain; full chat and
  pins are not expired. No autonomous speech, input or control is added.
- Graphics context loss stops the renderer but leaves navigation/chat available;
  restore reuses hull/camera, while unsupported/failed initialization gets a
  labelled software perspective fallback.
- Native conversation/Activity now uses actual AndroidX RecyclerView, stable row
  identities and DiffUtil updates. Telegram's pinned-source SmoothScroller is
  adapted against the real AndroidX stack. Fling/recycling/focus preservation are
  no longer delegated to the former ListView. Right-swipe replies to the touched
  message only; a session change during a swipe fences that action.

## Preserved boundaries

Pairing, TLS, signer, gateway transport, outbox/draft recovery, files, full records,
manual approved audio, all six speeds/seek/Stop, pins/history, Chamber and debugger
remain. No shared gateway or Watch backend change/restart is required. Native
row listeners still bind physical session/run/revision; no capability is inferred
from a renderer or a synthetic test. Avatar provisional provenance is separate
from run status. No old inputs/audio are replayed to generate acceptance.

## Evidence and honest limits

Ignored evidence: `mobile/runtime/spatial-040-20261016/`.
The source includes browser sustained-motion/camera/update/context-loss/fallback
checks, Android real-touch/WebView navigation and RecyclerView swipe fixtures,
and retained idle/audio/pin/custody checks. Android tests require an unpaired APK
and synthetic feed; no production messages or live controls are issued.

The old floating-overlay integration fixtures are superseded by the dock/3D
experience checks, not represented as green unchanged tests. Historical pure
packing helpers remain for compatibility; the live inspector never calls them.
The previously documented five broad browser failures remain unresolved; this
change does not claim the entire historic suite is green.

This delivers a real depth-aware cutaway, **not** a fully modelled 3D avatar world.
Original detailed avatars are billboard art. RecyclerView plus Telegram scrolling
is substantive native interaction work, **not full Telegram ChatActivity,
ChatMessageCell, composer or transport parity**. GPU frame presentation and
perceived smoothness on Cas's physical phone remain unverified. The debugger's
bounded CPU/RAF samples are not native/GPU presentation timing.
