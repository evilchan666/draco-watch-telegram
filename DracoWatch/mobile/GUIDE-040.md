# DRACO Watch 0.4.0

Update: Settings → Check updates → Install. Android still asks for installation
consent. Pairing, drafts, pins and 0.3.4's recovery path are preserved.

## Environment

- Drag the ship to orbit. Pinch with two fingers to zoom/pan.
- Fit restores the room view. Focus targets the selected agent.
- Tap a creature, station or agent chip to inspect it without leaving the scene.
- Conversation & pins opens that exact agent's native chat. Work details opens
  the existing operational stream. Landscape's inspection pane scrolls separately.
- Report preview switch remains your master preference. Idle previews expire;
  full conversations and pins remain. Unknown/disconnected freezes movement.
- Movement illustrates run occupancy, not proof that useful work is advancing.

## Conversation

Real RecyclerView handles the timeline. Updates preserve unchanged rows and
scrollback. Swipe a public message right to reply. Session replacement during
that gesture cancels it rather than replying in the wrong conversation.
Message menus, pins/history, drafts, outbox and exact control/recovery semantics
remain. Audio stays deliberate and report-bound, with existing speed/seek/Stop.

## Debugger

Settings → Watch debugger → Export diagnostic JSON. Includes bounded rendering
CPU/RAF, camera/context state, report-layout mode, connection/navigation and
native crash metadata. It does not automatically export message bodies or
credentials. GPU presented-frame timing and phone usability are separate evidence.

This is a perspective ship and a substantive native timeline upgrade, not full
Telegram client parity. Physical-phone smoothness has not been established by
emulator checks.
