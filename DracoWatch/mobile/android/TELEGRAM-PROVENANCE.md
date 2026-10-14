# Actual Telegram UI component integration — operator 3412

## Pinned source and license

- Actual fork: <https://github.com/evilchan666/draco-watch-telegram>
- Upstream: <https://github.com/DrKLO/Telegram>
- Exact source commit: `f32ffeec763f0bdbf4bec25b52d654f77bff733d`.
- License: GPL version 2 or later, with existing Telegram copyright notices retained.
- Complete upstream GPL text is `telegram/LICENSE`.
- Exact source bytes are retained as noncompiled `.java.txt` files under
  `telegram/upstream/`; SHA-256 values and original paths are in
  `telegram/upstream-sources.json`.
- The modified subset's corresponding source must accompany derived distribution
  according to the upstream license. No pairing profile, key, token or private
  gateway configuration is part of this source subtree.

This is **actual native Telegram-derived UI code**, not a WebView stylesheet that
imitates Telegram. It is a bounded component integration, not a claim that the
complete Telegram ChatActivity, transport, account/login or service is integrated.
Watch's six-agent data models and gateway remain authoritative.

## Compiled sources and transformations

### `org.telegram.ui.Components.ChatActivityEnterTopView`

Copied byte-for-byte from `Components/ChatActivityEnterTopView.java`. Android SDK
only; no Telegram service or model dependency. This is the actual reply/edit/
suggestion container used above Telegram's chat composer, including its nested
EditView and EditViewButton components. No package or implementation changes.

Callable surface:

- `ChatActivityEnterTopView(Context)`
- `addReplyView(View, FrameLayout.LayoutParams)`
- `addEditView(EditView, FrameLayout.LayoutParams)`
- `setEditMode(boolean)` / `setEditSuggestionMode(boolean)`
- `getReplyView()` / `getEditView()`

As upstream, switching edit modes requires both the reply and edit child to have
been added first. Watch must not call edit-mode switching before adding them.

### `org.omega.dracowatch.telegram.PinnedLineView`

Derived from the actual complete `Components/PinnedLineView.java`, retaining the
multi-pin indicator's geometry, selection/change animations, fading and layer
selection. The data source (which message is pinned) is Watch-owned, not faked
Telegram message objects.

Changes:

1. Relocated package; added an attribution/adaptation header.
2. Constructor takes `Context, int lineColor` instead of a Telegram
   `Theme.ResourcesProvider`.
3. `AndroidUtilities.dp/dpf2` replaced with equivalent local density conversion;
   density comes from that Context's display metrics.
4. `ColorUtils.setAlphaComponent` replaced with a bounded equivalent local helper.
5. `setColor(int)` supplies current Watch theme color instead of Theme keys.
6. Detachment clears pending selection and cancels the owned animator so the
   detached view cannot leave an animation scheduled.

Callable surface: `PinnedLineView(Context, int)`, `set(position, count, animated)`,
`setColor(int)`. Positions are zero-based.

### `org.omega.dracowatch.telegram.MessageDrawable`

A substantial extraction of the actual `ActionBar/MessageDrawable.java` renderer:
its complete `generatePath(...)` implementation is retained unchanged, including
incoming/outgoing tail geometry, adjoining-corner rules, media/preview modes and
radius clamping. This is not a re-created rounded rectangle or a copied SVG.

Changes:

1. Isolated original path generator in a plain Android `Drawable` with
   Context/density, explicit outgoing flag, color, type and radius.
2. Watch renders complete bounded cells, so `makePath()` selects full top/bottom
   drawing. Original generator branch/geometry code is retained.
3. Theme/account settings, gradient/motion backgrounds, nine-patch/shadow caches,
   viewport-sliced background rendering and their dependencies are omitted.
4. Standard Drawable alpha/color-filter methods update the local paint and
   invalidate. There are no Telegram Theme, SharedConfig, model or service stubs.

Callable surface:

- `MessageDrawable(Context, boolean outgoing, int color)`
- `setColor(int)` / `setAdjacent(boolean topNear, boolean bottomNear)`
- `setBubbleRadius(int dp)` / `setType(TYPE_TEXT | TYPE_MEDIA | TYPE_PREVIEW)`
- `setBotButtonsBottom(boolean)`
- normal `Drawable.setBounds(...)`, `draw(Canvas)`, alpha/filter methods
- `makePath()` returns its reusable path; callers must not mutate it.

### `org.omega.dracowatch.telegram.BackDrawable`

The complete actual Telegram navigation-arrow/close morph drawable, with original
header retained. Package relocation, explicit Context density, removal of unused
imports/AndroidX annotations, equivalent local density/lerp/ARGB blend helpers.
Animation and drawing logic is retained. Constructor is
`BackDrawable(Context, boolean alwaysClose)`; existing `setColor`,
`setRotatedColor`, `setRotation(float, boolean)`, `setAnimationTime`,
`setArrowRotation` and Drawable APIs remain.

### `org.omega.dracowatch.telegram.CubicBezierInterpolator`

Actual complete upstream interpolation implementation, relocated. The one literal
path formerly parsed by AndroidX PathParser is constructed using equivalent
Android Path cubic commands; the path, numeric control points and interpolation
algorithm are unchanged. No AndroidX dependency is required.

## Verification and boundaries

A scoped Android SDK 35 / Java 8 `javac` compile of all five owned components
completed successfully and emitted nine class files. This confirms the concrete
subset compiles with the existing offline Watch toolchain, not whole-app linking,
UI wiring, APK installation, physical-device appearance or feature acceptance.
Root integration owns those distinct checks.

The original chat composer (`ChatActivityEnterView`: 15,745 lines), chat message
cell (`ChatMessageCell`: 29,584 lines), and `RecyclerListView` (3,914 lines) have
strong application/model/theme/blur/AndroidX dependencies. They are **not** silently
represented as integrated. Their import graphs were inspected; no fake
MessagesController, MessageObject, TLRPC or Theme implementations were introduced
merely to make the compiler pass.

The root app integrates this subset with Watch-native message, composer, pin,
activity and bridge adapters. Retaining the unchanged legacy WebView features is
separate from claiming every surface now uses Telegram native components.
