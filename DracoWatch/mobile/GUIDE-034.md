# DRACO Watch 0.3.4

This is a client-performance update to 0.3.3, preserving the original black/red
design and agent colours. It reduces repeated work while typing, receiving
updates, scrolling and showing player state. It does not change the gateway.

## Update

Open **Settings → Check updates → Install**. Android asks for installation
consent. The original signer and pairing remain; do not clear application data.
The private updater now serves 0.3.4/code23. Installation is not automatic.

## Using the interface

- **Chats:** native conversation, selectable reports, replies, attachments,
  drafts, local pins/history and the full composer remain. Rich full-text views
  are constructed when opened rather than beneath every native update.
- **Activity:** follow new entries at the bottom. Scroll back to pause following;
  use **Resume live** to return. Changed observations refresh their exact revision.
- **Audio:** playback remains deliberate and report-bound. Speed, pause, seek and
  Stop use the existing player; opening a conversation does not enable speech.
- **Chamber / Environment:** retained unchanged with six distinct identities.
- **Controls:** exact-run Steer, Stop & hold / Abort and explicit hold release
  retain 0.3.3's advertised-capability and exact-target checks. Faster presentation
  does not turn an acknowledgment into confirmed adoption or completion.
- **Original information:** use **Recorded detail** to inspect original retained
  input/script/result; compact timeline previews do not replace it.
- **Debugger:** **Settings → Watch debugger** records local diagnostics and exports
  a support bundle. Local WebView inspection remains an explicit separate choice.

If a problem occurs, export diagnostics immediately after it. This captures the
installed version and recent state without requiring you to reconstruct the
sequence from memory. Do not clear drafts or retry uncertain work just to test UI.

Android synthetic checks passed in both orientations with enlarged system text.
Smoothness and usability on the physical phone remain unverified.
