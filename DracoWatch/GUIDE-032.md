# Watch 0.3.2 guide

Implementation guide for the next version. Publication, installation and phone
acceptance are recorded separately in the release evidence; this document alone
does not claim them.

## Chats and the Telegram integration

Watch retains the actual Telegram-derived native components and its original
black/red identity. It remains a personal authenticated OpenClaw client, not a
Telegram login migration or a full Telegram delivery-history reader. Chats and
Activity use native Android rows; Settings, Chamber and Environment use the
integrated WebView. One app-scale preference applies across both renderers, with
Android font scale preserved.

Open an agent to read the conversation. Original local requests appear in the
chronology, with their admission state separate from the body. Admission is not
read/start/completion. Work and source-coverage information is expandable rather
than permanently filling the conversation. Pin context and advanced actions
remain available. Drafts and uncertain original request IDs are not replayed on
navigation, reconnect or upgrade.

## Audio is your choice

The upgrade migrates the old implicit/default-on automatic-speech setting to
manual. By default, opening a chat, receiving a reply and reconnecting do not
start speech. You can explicitly enable automatic speech for **new final
replies** in Settings after its confirmation; opening history and reconnecting
remain silent even with that option enabled.
An existing approved recording and **Read aloud** are different actions: one
downloads an available recording; the other prepares new approved speech for
that exact readable report. Audio controls show the report/source, preparation
or transfer progress, position/duration, pause/resume, seek and Stop when those
operations are available. Idle player chrome is hidden.

Saved rates are 0.5, 0.75, 1, 1.25, 1.5 and 2×, with fixed pitch and cooperative
audio that does not request exclusive focus. Cancelling speech preparation stops
waiting/playback locally; it does not claim cancellation of an already running
server synthesis. Old audio is never automatically replayed.

A voice attachment is not a complete readable reply. A missing text leg stays
labelled as incomplete, with the actual available source/receipt facts. Separate
nearby text is not invented as a transcript or associated by timestamp. If the
producer never supplied readable text or a valid media binding, Watch cannot
manufacture either; that remains a producer/transport requirement.

## Activity: follow, pause, inspect

Events are chronological, with the live edge at the bottom. When following,
updates stay in view. Scrolling back pauses follow and preserves the reading
anchor. The new-event indicator and **Resume live** return to the live edge.
Unchanged polls do not count as new work. Agent and Live/Work filters apply to the
displayed native rows as well as the fallback.

Compact operational summaries show supplied commands, numeric outcomes, public
reported checklist steps and automation facts. They are not hidden reasoning.
Submitted scripts show what was submitted; they do not prove every inner tool
executed. Missing nested events and unavailable current-operation facts remain
explicit rather than inferred from an open turn.

**Recorded detail** opens the original retained tool payload separately from the
compact feed. It includes recorded inputs/scripts and result content, including
your paths, memory data and ordinary literals. The authenticated read is bound to
the agent, physical conversation, run, call, source record and revision. Long
records are paged without rerunning the operation. Recognizable credential values
are initially masked; you can deliberately reveal them for that exact record.
The underlying retained payload is not rewritten. Detail is not sent to speech
or copied into public summaries.

An unavailable record explains whether its owner/session changed, the source was
truncated, the exact record disappeared or the revision changed. This is not a
machine-wide file browser or a claim that the gateway retained every event.

## Debugger and support export

Open **Watch debugger** from Settings or the chat's advanced menu. It combines
the app's local state/native crash journal with the authenticated Watch-service
metadata journal. Export the diagnostic JSON to a destination you choose through
Android's share interface. Export does not automatically send a message to an
agent. Automatic diagnostics contain request/correlation identities, errors,
navigation, scale and playback phases—not conversation bodies, full tool data,
pairing credentials or arbitrary local files. Original owner details are a
separate deliberate inspection/export.

For deeper inspection, **local WebView inspection** requires an explicit Android
confirmation and a connected debugging computer. It is off by default and turns
off when the app leaves the foreground. Watch does not start a network debugger
listener. The support export is intended to diagnose ordinary failures without
requiring you to use developer tools.

## Existing features and remaining boundaries

Chamber, top-down Environment/creatures, agent accents, speech bubbles, pins,
history, attachments, voice-note recording, drafts/outbox, signed updater and
pairing remain. Selecting or recording an attachment does not itself submit it.
Send/Queue are deliberate follow-up admission; Queue may start immediately when
idle. Stop targets the displayed exact run where the host advertises authority.

Genuine exact-selected-run **Steer** remains unsupported by the serving gateway
and refuses without dispatch; it never silently becomes Queue. Complete
request→read/start→result/reply association still depends on actual supplied
identities and lifecycle evidence. The app does not equate occupancy with useful
work, a tool return with a successful application outcome, or a Telegram receipt
with phone playback.

Install through Settings → Check updates → Install once a matching release is
published. Android requires its own installation confirmation. Keep installation
and physical-phone usability separate from source, emulator and updater checks.
