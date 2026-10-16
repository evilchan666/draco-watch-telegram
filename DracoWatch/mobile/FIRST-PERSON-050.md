# First-person operating space — Watch 0.5.0 candidate

Direct operator clarification: Environment is the main operating space, fullscreen,
with a local first-person avatar, full controls and full-feature agent communication.
The rejected 0.4.1 overview is retained as release history, not the acceptance target.

## Implemented boundary

- Environment is the initial/home view, uses the whole available screen, and asks
  native Android for reversible immersive bars. Menus, chat, Settings and IME
  restore normal chrome; Android swipe-to-reveal remains available.
- Local eye-height player in a human-scale 14x20m room. Touch movement pad,
  independent drag-look, keyboard WASD/arrows, bounded wall/console collision,
  explicit reset and focus that turns in place rather than teleporting.
- First-person wrist/hand representation is local UI artwork, not a networked or
  volumetric avatar rig. Agent creatures retain their original billboard artwork.
  Walking/looking are local actions, not agent activity or productive-work claims.
- Reticle/tap identifies an exact agent. Talk opens the existing complete
  session-bound native conversation, not a reduced spatial messaging transport.
  Pins/history, files, voice recording, manual report speech, commands, work detail,
  draft/outbox custody and supported exact-run controls keep existing paths.
- Returning from conversation/auxiliary screens preserves the in-memory player
  position and look. Menus/chat/blur/background clear movement. Process recreation
  starts at the spawn point; no cross-device/network player state is claimed.
- No permanent dashboard cards, bottom tab bar or overview camera rail in the world.
  Agents/tools and other surfaces remain reachable from the world menu.
- Dirty-resize repaint/context recovery retained. Compatibility rendering uses a
  simpler depth-buffered room, not a claim of WebGL visual/performance parity.

## Connection correction and unresolved phone report

Direct evidence: physical-session rollover could strand an older capability cache
entry, disabling advanced features until reconnect. Evict mismatched session entries;
accept a capability response only for the exact physical session captured at dispatch.
Late responses after disconnect/session replacement cannot restore capabilities.
An in-memory baseline control reproduces this bug; focused fixture verifies repair.

The reported handset failure is NOT fully diagnosed. Retained relay snapshots were
fresh, but server health is not phone request acceptance. Native snapshot failures
previously lacked bounded class/status/duration/correlation metadata. The new journal
preserves these without URLs, credentials, exception messages or message content.
World HUD identifies gateway-feed state, not full end-to-end messaging success.
No speculative profile replacement, TLS weakening, timeout-budget change, admitted
POST retry, historical replay, shared gateway or Watch-backend restart is included.

## Acceptance evidence

See ignored runtime/world-042-20261016 for actual render previews, browser checks,
engine/context/fallback/navigation evidence and Android results. New first-person
geometry/gesture checks intentionally replace the old fitted-overview/orbit target;
old chat/custody tests remain separate. Synthetic fixtures are not physical S25
installation, perceived quality, sustained device FPS or live control acceptance.
Known older broad-fixture failures remain open, not relabelled as a green full suite.
