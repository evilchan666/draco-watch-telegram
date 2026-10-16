package org.omega.dracowatch;

import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.text.Editable;
import android.text.InputType;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import androidx.recyclerview.widget.RecyclerView;
import androidx.recyclerview.widget.DiffUtil;
import androidx.recyclerview.widget.ItemTouchHelper;

import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;

import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.omega.dracowatch.telegram.BackDrawable;
import org.omega.dracowatch.telegram.MessageDrawable;
import org.omega.dracowatch.telegram.PinnedLineView;
import org.telegram.ui.Components.ChatActivityEnterTopView;

import java.text.DateFormat;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.WeakHashMap;

/**
 * Native Watch conversation surface using the actual Telegram-derived message,
 * back-navigation, pin-line and enter-top components vendored with this client.
 *
 * This is only a renderer and an action adapter. It neither logs into Telegram
 * nor sends gateway requests; Watch's existing owner-bound bridge remains the
 * sole state/custody authority. In particular a rendered status is never a new
 * delivery, injection, or physical-device acceptance receipt.
 */
public final class TelegramSurface extends FrameLayout {
    public interface Actions {
        void send(String action, JSONObject data);
    }

    // Match Watch's original black/red shell, not Telegram's default blue/green.
    // Agent identity accents are supplied by the same Watch roster as the world.
    private static final int BACKGROUND = 0xff000000;
    private static final int PANEL = 0xff101010;
    private static final int PANEL_LIGHT = 0xff202020;
    private static final int INCOMING = 0xff151515;
    private static final int TEXT = 0xffffffff;
    private static final int SECONDARY = 0xffbcbcbc;
    private static final int ACCENT = 0xffff263c;
    private static final int SELECTED = 0xff00ffff;
    private static final int WARNING = 0xffffd38d;
    static final int TAG_ROW_KEY = 0x7f0f3412;
    private static final String[] VIEWS = {
        "chats", "chamber", "environment", "activity", "settings"
    };
    private static final String[] VIEW_LABELS = {
        "Chats", "Chamber", "Environment", "Activity", "Settings"
    };
    private static final String[] COMPACT_VIEW_LABELS = {"Chats", "Room", "World", "Live", "More"};
    private static final double[] RATES = {.5, .75, 1, 1.25, 1.5, 2};

    private final Actions actions;
    private final LinearLayout shell;
    private final LinearLayout header;
    private final LinearLayout heading;
    private final ImageView backButton;
    private final BackDrawable backDrawable;
    private final TextView title;
    private final TextView subtitle;
    private final Button runStop;
    private final TextView work;
    private final TextView history;
    private final LinearLayout pinBar;
    private final PinnedLineView pinLine;
    private final TextView pinTitle;
    private final TextView pinPreview;
    private final LinearLayout voiceBar;
    private final TextView voice;
    private final Button speed;
    private final Button stopAudio;
    private final Button pauseAudio;
    private final TextView audioTime;
    private final SeekBar audioSeek;
    private final LinearLayout audioPanel;
    private final Button activityFilter;
    private final TimelineView list;
    private final SurfaceAdapter adapter;
    private final TextView jump;
    private final LinearLayout compose;
    private final ChatActivityEnterTopView replyTop;
    private final TextView reply;
    private final TextView pending;
    private final EditText input;
    private final Button attach;
    private final Button microphone;
    private final Button send;
    private final Button modeSelector;
    private final LinearLayout footer;
    private final List<TextView> navigation = new ArrayList<>();
    private final Set<String> expanded = new HashSet<>();
    private final WeakHashMap<TextView, Float> baseTextSizes = new WeakHashMap<>();

    private JSONObject payload = new JSONObject();
    private String identity = "";
    private String viewName = "chats";
    private String rowsSignature = "";
    private String rowContext = "";
    private String chromeSignature = "";
    private boolean chat;
    private boolean settingDraft;
    private boolean visible;
    private boolean listAtEnd = true;
    private int pinPosition;
    private String pendingSignature = "";
    private float appScale = 1f;
    private float nativeFontScale;
    private JSONObject actionScope;
    private String submittedDraft;
    private String selectedSendMode = "send";
    private String modeRunId = "";
    private String lastFocusMessage = "";
    private boolean compactLayout;
    private boolean shortLayout;
    private final Set<String> seenTimelineKeys = new LinkedHashSet<>();
    private long timelineNewestTime;
    private int unreadTimeline;
    private boolean replacingRows;
    private boolean followLive = true;
    private boolean seekingAudio;

    public TelegramSurface(Context context, Actions actions) {
        super(context);
        this.actions = actions;
        nativeFontScale = getResources().getConfiguration().fontScale;
        setTag("telegram-surface");
        setBackgroundColor(BACKGROUND);
        setVisibility(GONE);

        shell = vertical();
        addView(shell, new FrameLayout.LayoutParams(-1, -1));

        header = vertical();
        header.setBackgroundColor(PANEL);
        header.setPadding(dp(4), dp(5), dp(4), dp(4));
        shell.addView(header, new LinearLayout.LayoutParams(-1, -2));
        heading = horizontal();
        header.addView(heading, new LinearLayout.LayoutParams(-1, -2));

        backDrawable = new BackDrawable(context, false);
        backDrawable.setColor(TEXT);
        backButton = new ImageView(context);
        backButton.setTag("telegram-back");
        backButton.setImageDrawable(backDrawable);
        backButton.setPadding(dp(14), dp(12), dp(14), dp(12));
        backButton.setContentDescription("Back to agent conversations");
        backButton.setOnClickListener(v -> back());
        heading.addView(backButton, new LinearLayout.LayoutParams(dp(48), dp(48)));

        LinearLayout headingText = vertical();
        headingText.setPadding(dp(4), 0, dp(4), 0);
        title = text(19, TEXT, true);
        title.setTag("telegram-title");
        title.setMaxLines(1);
        title.setEllipsize(TextUtils.TruncateAt.END);
        subtitle = text(12, SECONDARY, false);
        subtitle.setTag("telegram-status");
        subtitle.setMaxLines(1);
        subtitle.setEllipsize(TextUtils.TruncateAt.END);
        title.setOnClickListener(v -> showWorkCoverage());
        subtitle.setOnClickListener(v -> showWorkCoverage());
        headingText.addView(title);
        headingText.addView(subtitle);
        heading.addView(headingText, new LinearLayout.LayoutParams(0, -2, 1));

        runStop = button("Abort run", "Abort the exact observed run; automatic continuation may remain possible");
        runStop.setTag("telegram-stop-run");
        runStop.setTextColor(WARNING);
        icon(runStop, "stop", WARNING);
        runStop.setOnClickListener(v -> available("abort", "stop", "No supported Stop target is currently observed. Nothing was dispatched."));
        heading.addView(runStop, new LinearLayout.LayoutParams(-2, -2));

        Button overflow = button("⋮", "Conversation and activity options");
        overflow.setTag("telegram-options");
        overflow.setTextSize(23);
        icon(overflow, "more", TEXT);
        overflow.setOnClickListener(v -> showOptions());
        heading.addView(overflow, new LinearLayout.LayoutParams(dp(44), -2));

        pinBar = horizontal();
        pinBar.setTag("telegram-pinned-banner");
        pinBar.setBackgroundColor(PANEL_LIGHT);
        pinBar.setPadding(dp(10), dp(5), dp(4), dp(5));
        shell.addView(pinBar, new LinearLayout.LayoutParams(-1, -2));
        pinLine = new PinnedLineView(context, ACCENT);
        pinBar.addView(pinLine, new LinearLayout.LayoutParams(dp(3), dp(44)));
        LinearLayout pinText = vertical();
        pinText.setPadding(dp(10), 0, dp(4), 0);
        pinTitle = text(13, ACCENT, true);
        pinPreview = text(13, TEXT, false);
        pinPreview.setMaxLines(2);
        pinPreview.setEllipsize(TextUtils.TruncateAt.END);
        pinText.addView(pinTitle);
        pinText.addView(pinPreview);
        pinBar.addView(pinText, new LinearLayout.LayoutParams(0, -2, 1));
        pinText.setContentDescription("Open pinned message. Long press for pin navigation and history.");
        pinText.setOnClickListener(v -> openCurrentPin());
        pinText.setOnLongClickListener(v -> {
            showPinOptions();
            return true;
        });
        Button pinMenu = button("⋮", "Pinned message navigation and history");
        pinMenu.setTag("telegram-pin-options");
        icon(pinMenu, "more", SECONDARY);
        pinMenu.setOnClickListener(v -> showPinOptions());
        pinBar.addView(pinMenu, new LinearLayout.LayoutParams(dp(44), -2));

        work = text(12, SECONDARY, false);
        work.setTag("telegram-work-summary");
        work.setMaxLines(2);
        work.setEllipsize(TextUtils.TruncateAt.END);
        work.setPadding(dp(12), dp(4), dp(12), dp(4));
        work.setOnClickListener(v -> showWorkCoverage());
        shell.addView(work, new LinearLayout.LayoutParams(-1, -2));

        history = text(12, WARNING, false);
        history.setTag("telegram-history-state");
        history.setPadding(dp(12), dp(3), dp(12), dp(5));
        history.setMaxLines(3);
        history.setOnClickListener(v -> showText("History coverage", history.getText().toString()));
        shell.addView(history, new LinearLayout.LayoutParams(-1, -2));

        FrameLayout body = new FrameLayout(context);
        shell.addView(body, new LinearLayout.LayoutParams(-1, 0, 1));
        list = new TimelineView(context);
        list.setTag("telegram-timeline");
        list.setClipToPadding(false);
        list.setPadding(dp(6), dp(8), dp(6), dp(52));
        adapter = new SurfaceAdapter();
        list.setAdapter(adapter);
        list.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override public void onScrollStateChanged(RecyclerView view,int value) {
                if(value==RecyclerView.SCROLL_STATE_DRAGGING)followLive=listAtEnd;
            }
            @Override public void onScrolled(RecyclerView view,int dx,int dy) {
                listAtEnd=!list.canScrollVertically(1);
                if(!replacingRows){followLive=listAtEnd;if(listAtEnd)unreadTimeline=0;}
                updateJump();
            }
        });
        new ItemTouchHelper(new ItemTouchHelper.SimpleCallback(0,ItemTouchHelper.RIGHT){
            private String swipeKey="";
            private JSONObject swipeScope;
            @Override public void onSelectedChanged(RecyclerView.ViewHolder holder,int actionState){
                super.onSelectedChanged(holder,actionState);
                if(holder!=null&&actionState==ItemTouchHelper.ACTION_STATE_SWIPE){
                    int p=holder.getBindingAdapterPosition();
                    swipeKey=p>=0&&p<adapter.rows.size()?adapter.rows.get(p).key:"";
                    swipeScope=scope();
                }
            }
            @Override public boolean onMove(RecyclerView r,RecyclerView.ViewHolder a,RecyclerView.ViewHolder b){return false;}
            @Override public int getSwipeDirs(RecyclerView r,RecyclerView.ViewHolder h){
                int p=h.getBindingAdapterPosition();if(!chat||p<0||p>=adapter.rows.size())return 0;
                Row row=adapter.rows.get(p);return "message".equals(row.type)&&!row.value.optBoolean("localSubmission")&&row.value.optBoolean("canReply")?ItemTouchHelper.RIGHT:0;
            }
            @Override public void onSwiped(RecyclerView.ViewHolder h,int direction){
                int p=h.getBindingAdapterPosition();if(p<0||p>=adapter.rows.size())return;
                Row row=adapter.rows.get(p);adapter.notifyItemChanged(p);
                if(swipeScope!=null&&sameScope(swipeScope)&&swipeKey.equals(row.key)&&chat&&"message".equals(row.type)&&!row.value.optBoolean("localSubmission")&&row.value.optBoolean("canReply"))withScope(swipeScope,()->emit("reply",data("id",row.value.optString("id"))));
            }
            @Override public float getSwipeThreshold(RecyclerView.ViewHolder h){return .35f;}
        }).attachToRecyclerView(list);
        body.addView(list, new FrameLayout.LayoutParams(-1, -1));

        jump = text(13, TEXT, true);
        jump.setText("↓ Latest");
        jump.setTag("telegram-jump-latest");
        jump.setGravity(Gravity.CENTER);
        jump.setPadding(dp(15), dp(10), dp(15), dp(10));
        jump.setBackground(round(PANEL_LIGHT, 24));
        jump.setElevation(dp(4));
        jump.setContentDescription("Jump to latest message or activity");
        jump.setOnClickListener(v -> jumpToLatest());
        FrameLayout.LayoutParams jumpParams = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.END);
        jumpParams.setMargins(dp(8), dp(8), dp(10), dp(8));
        body.addView(jump, jumpParams);

        activityFilter = button("All agents · live", "Filter the activity timeline");
        activityFilter.setTag("telegram-activity-filter");
        activityFilter.setOnClickListener(v -> showActivityFilter());
        shell.addView(activityFilter, new LinearLayout.LayoutParams(-1, dp(44)));

        voiceBar = horizontal();
        voiceBar.setTag("telegram-voice-controls");
        voiceBar.setBackgroundColor(PANEL);
        voiceBar.setPadding(dp(8), dp(2), dp(5), dp(2));
        voice = text(12, SECONDARY, false);
        voice.setMaxLines(1);
        voice.setEllipsize(TextUtils.TruncateAt.END);
        voice.setOnClickListener(v -> showText("Voice playback state", payload.optString("voiceStatus", "Voice status unavailable")));
        voiceBar.addView(voice, new LinearLayout.LayoutParams(0, -2, 1));
        speed = button("1×", "Change pitch-preserving audio playback speed");
        speed.setTag("telegram-speed");
        // Short rates such as 1× still need the same complete touch target.
        speed.setMinWidth(dp(42));
        speed.setMinimumWidth(dp(42));
        speed.setOnClickListener(v -> showRates());
        voiceBar.addView(speed, new LinearLayout.LayoutParams(-2, -2));
        pauseAudio = button("Pause", "Pause or resume this exact audio report");
        pauseAudio.setTag("telegram-pause-audio");
        pauseAudio.setOnClickListener(v -> {
            JSONObject audio = currentAudio();
            if (audio == null) return;
            emit("paused".equals(audio.optString("state")) ? "audioResume" : "audioPause", data("playbackId", audio.optString("id")));
        });
        voiceBar.addView(pauseAudio, new LinearLayout.LayoutParams(-2, -2));
        stopAudio = button("Stop audio", "Stop audio immediately");
        stopAudio.setTag("telegram-stop-audio");
        icon(stopAudio, "stop", TEXT);
        stopAudio.setOnClickListener(v -> emit("stopAudio"));
        voiceBar.addView(stopAudio, new LinearLayout.LayoutParams(-2, -2));
        audioPanel = vertical();
        audioPanel.setTag("telegram-audio-player");
        audioPanel.addView(voiceBar, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout seekRow = horizontal();
        audioTime = text(12, SECONDARY, false);
        audioTime.setTag("telegram-audio-time");
        audioTime.setPadding(dp(8), 0, dp(5), 0);
        seekRow.addView(audioTime, new LinearLayout.LayoutParams(-2, dp(40)));
        audioSeek = new SeekBar(context);
        audioSeek.setTag("telegram-audio-seek");
        audioSeek.setMax(1000);
        audioSeek.setContentDescription("Seek within this exact audio report");
        audioSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            String id, expectedIdentity; long duration;
            public void onProgressChanged(SeekBar bar, int progress, boolean user) { }
            public void onStartTrackingTouch(SeekBar bar) {
                JSONObject audio = currentAudio(); seekingAudio = true;
                id = audio == null ? "" : audio.optString("id");
                duration = audio == null ? 0 : audio.optLong("durationMs"); expectedIdentity = identity;
            }
            public void onStopTrackingTouch(SeekBar bar) {
                seekingAudio = false; JSONObject audio = currentAudio();
                if (audio != null && identity.equals(expectedIdentity) && id.equals(audio.optString("id")) && duration > 0 && audio.optBoolean("canSeek")) {
                    JSONObject value = data("playbackId", id);
                    try { value.put("positionMs", Math.round(duration * bar.getProgress() / 1000.0)); } catch (JSONException ignored) { }
                    emit("audioSeek", value);
                }
            }
        });
        seekRow.addView(audioSeek, new LinearLayout.LayoutParams(0, dp(40), 1));
        audioPanel.addView(seekRow, new LinearLayout.LayoutParams(-1, -2));
        shell.addView(audioPanel, new LinearLayout.LayoutParams(-1, -2));

        compose = vertical();
        compose.setTag("telegram-composer");
        compose.setBackgroundColor(PANEL);
        replyTop = new ChatActivityEnterTopView(context);
        replyTop.setTag("telegram-enter-top");
        reply = text(13, ACCENT, false);
        reply.setPadding(dp(12), dp(7), dp(12), dp(7));
        reply.setMaxLines(3);
        reply.setEllipsize(TextUtils.TruncateAt.END);
        replyTop.addReplyView(reply, new FrameLayout.LayoutParams(-1, -2));
        replyTop.setContentDescription("Reply context. Tap to open the complete composer and manage the reply.");
        replyTop.setOnClickListener(v -> emit("composer"));
        compose.addView(replyTop, new LinearLayout.LayoutParams(-1, -2));

        pending = text(12, SECONDARY, false);
        pending.setTag("telegram-pending");
        pending.setPadding(dp(12), dp(4), dp(12), dp(5));
        pending.setMaxLines(3);
        pending.setEllipsize(TextUtils.TruncateAt.END);
        pending.setOnClickListener(v -> emit("composer"));
        compose.addView(pending, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout editor = horizontal();
        editor.setPadding(dp(4), dp(4), dp(4), dp(4));
        compose.addView(editor, new LinearLayout.LayoutParams(-1, -2));
        attach = button("＋", "Attach files");
        attach.setTag("telegram-attach");
        icon(attach, "attach", SECONDARY);
        attach.setOnClickListener(v -> available("attachments", "attach", "Attachments are unavailable in this conversation."));
        editor.addView(attach, new LinearLayout.LayoutParams(dp(42), -2));
        input = new EditText(context);
        input.setTag("telegram-draft");
        input.setTextColor(TEXT);
        input.setHintTextColor(SECONDARY);
        input.setTextSize(16);
        baseTextSizes.put(input, 16f);
        input.setHint("Message");
        input.setBackground(round(BACKGROUND, 20));
        input.setPadding(dp(12), dp(8), dp(12), dp(8));
        input.setMinLines(1);
        input.setMaxLines(5);
        input.setMaxHeight(dp(112));
        input.setVerticalScrollBarEnabled(true);
        input.setOverScrollMode(OVER_SCROLL_IF_CONTENT_SCROLLS);
        input.setGravity(Gravity.TOP | Gravity.START);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setImeOptions(EditorInfo.IME_FLAG_NO_EXTRACT_UI);
        input.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (!settingDraft) {
                    submittedDraft = null;
                    emit("draft", data("text", s.toString()));
                }
            }
            @Override public void afterTextChanged(Editable value) { }
        });
        editor.addView(input, new LinearLayout.LayoutParams(0, -2, 1));
        microphone = button("Mic", "Record voice message");
        microphone.setTag("telegram-mic");
        microphone.setTextSize(12);
        icon(microphone, "microphone", SECONDARY);
        microphone.setOnClickListener(v -> {
            if (payload.optBoolean("recording")) emit("recordStop");
            else available("voice", "record", "Recording is unavailable in this conversation.");
        });
        editor.addView(microphone, new LinearLayout.LayoutParams(dp(45), -2));
        modeSelector = button("Follow-up ▾", "Send mode: Follow-up. Choose Send, Queue or Steer without submitting the draft.");
        modeSelector.setTag("telegram-send-mode");
        modeSelector.setMinWidth(dp(42));
        modeSelector.setMinimumWidth(dp(42));
        modeSelector.setMinHeight(dp(44));
        modeSelector.setMinimumHeight(dp(44));
        modeSelector.setMaxLines(1);
        modeSelector.setOnClickListener(v -> showSendOptions());
        editor.addView(modeSelector, new LinearLayout.LayoutParams(-2, -2));
        send = button("Send", "Send message using the visible mode selector");
        send.setTag("telegram-send");
        send.setTextColor(ACCENT);
        icon(send, "send", ACCENT);
        send.setOnClickListener(v -> sendMode(selectedSendMode));
        send.setOnLongClickListener(v -> {
            showSendOptions();
            return true;
        });
        editor.addView(send, new LinearLayout.LayoutParams(-2, -2));
        shell.addView(compose, new LinearLayout.LayoutParams(-1, -2));

        footer = horizontal();
        footer.setTag("telegram-navigation");
        footer.setBackgroundColor(PANEL);
        for (int i = 0; i < VIEWS.length; i++) {
            final String destination = VIEWS[i];
            TextView tab = text(11, SECONDARY, true);
            tab.setText(VIEW_LABELS[i]);
            tab.setGravity(Gravity.CENTER);
            tab.setPadding(dp(2), dp(5), dp(2), dp(5));
            tab.setMinHeight(dp(48));
            tab.setMaxLines(1);
            tab.setEllipsize(TextUtils.TruncateAt.END);
            tab.setCompoundDrawablePadding(dp(3));
            tab.setTag("telegram-nav-" + destination);
            tab.setContentDescription("Open " + VIEW_LABELS[i]);
            tab.setOnClickListener(v -> emit("view", data("view", destination)));
            navigation.add(tab);
            footer.addView(tab, new LinearLayout.LayoutParams(0, -2, 1));
        }
        shell.addView(footer, new LinearLayout.LayoutParams(-1, -2));
    }

    /** Must be called on the UI thread by the existing native bridge. */
    public void render(JSONObject value) {
        if (value == null) return;
        payload = value;
        boolean nextVisible = value.optBoolean("visible", false);
        visible = nextVisible;
        setVisibility(nextVisible ? VISIBLE : GONE);
        if (!nextVisible) return;

        float nextScale = (float) Math.max(1, Math.min(1.5, value.optDouble("appScale", 1)));
        float nextNativeFontScale = getResources().getConfiguration().fontScale;
        if (appScale != nextScale || nativeFontScale != nextNativeFontScale) {
            appScale = nextScale;
            nativeFontScale = nextNativeFontScale;
            applyScale(shell);
            rowsSignature = "";
            chromeSignature = "";
            adapter.clearRowViews();
        }

        boolean nextChat = value.optBoolean("chat");
        String nextView = value.optString("view", "chats");
        String nextIdentity = nextView + ":" + nextChat + ":" + ("activity".equals(nextView) ? value.optString("activityFilter", "all") + ":" + value.optString("activityMode", "live") + ":" : "") + value.optString("agent") + ":"
            + value.optString("sessionKey") + ":" + value.optString("sessionId");
        boolean changedConversation = !nextIdentity.equals(identity);
        if (changedConversation) {
            identity = nextIdentity;
            pinPosition = 0;
            expanded.clear();
            adapter.clearRowViews();
            rowsSignature = "";
            chromeSignature = "";
            input.clearFocus();
            submittedDraft = null;
            selectedSendMode = "send";
            lastFocusMessage = "";
            listAtEnd = true;
            followLive = true;
            seenTimelineKeys.clear(); unreadTimeline = 0; timelineNewestTime = 0;
        }
        String currentModeRunId = value.optString("controlRunId");
        if (!modeRunId.equals(currentModeRunId)) {
            modeRunId = currentModeRunId;
            selectedSendMode = "send";
        }
        chat = nextChat;
        viewName = nextView;
        updateLayoutMode();
        updateChrome(changedConversation);
        updateRows(changedConversation);
        focusRequestedMessage();
        updateJump();
    }

    public boolean showing() {
        return visible && getVisibility() == VISIBLE;
    }

    public boolean back() {
        if (!showing()) return false;
        // The WebView owns the navigation stack and the retained player pose.
        // Native chat, Activity and roster all return through that same reducer.
        emit("back");
        return true;
    }

    @Override protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        if (jump == null || !showing()) return;
        updateLayoutMode();
        chromeSignature = "";
        updateChrome(false);
    }

    private void updateLayoutMode() {
        int height = getHeight() > 0 ? getHeight() : dp(getResources().getConfiguration().screenHeightDp);
        int width = getWidth() > 0 ? getWidth() : dp(getResources().getConfiguration().screenWidthDp);
        shortLayout = height > 0 && height < dp(520);
        compactLayout = shortLayout || appScale * nativeFontScale >= 1.45f || width < dp(360);
    }

    private void updateChrome(boolean changedConversation) {
        JSONObject can = payload.optJSONObject("can");
        String signature = payload.optString("name") + payload.optString("status") + payload.optBoolean("live")
            + payload.optString("historyNote") + payload.optString("workSummary") + payload.optString("voiceStatus")
            + payload.optDouble("playbackRate", 1) + payload.optString("replyLabel") + payload.optString("color") + selectedSendMode
            + String.valueOf(can) + String.valueOf(payload.optJSONArray("pins")) + compactLayout + shortLayout + payload.optBoolean("recording")
            + String.valueOf(payload.optJSONObject("audio")) + payload.optString("activityFilter") + payload.optString("activityMode");
        if (!signature.equals(chromeSignature)) {
            chromeSignature = signature;
            placePinBanner();
            int color = chat ? agentColor(payload.optString("agent")) : ACCENT;
            if (chat) {
                setText(title, payload.optString("name", "Agent conversation"));
                title.setTextColor(color);
            } else if ("activity".equals(viewName)) {
                setText(title, "Live activity");
                title.setTextColor(TEXT);
            } else {
                SpannableString brand = new SpannableString("DRACO WATCH");
                brand.setSpan(new ForegroundColorSpan(ACCENT), 6, brand.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                if (!(title.getText() instanceof Spanned) || !"DRACO WATCH".contentEquals(title.getText())) title.setText(brand);
                title.setTextColor(TEXT);
            }
            reply.setTextColor(color);
            input.setHighlightColor(withAlpha(color, 0x55));
            icon(send, "send", BACKGROUND);
            send.setBackground(round(color, 14));
            jump.setBackground(outline(PANEL_LIGHT, 24, chat ? color : SELECTED));
            backButton.setVisibility(chat || !"chats".equals(viewName) ? VISIBLE : GONE);
            runStop.setVisibility(chat ? VISIBLE : GONE);
            boolean durableStop = capability("durableStop");
            setText(runStop, durableStop ? "Stop & hold" : "Abort run");
            runStop.setContentDescription(durableStop ? "Stop the exact run and hold automatic continuation until explicit release" : "Abort the exact run; automatic continuation may remain possible");
            runStop.setAlpha(capability("abort") ? 1 : .55f);
            backDrawable.setRotation(0, false);
            String state = payload.optString("status", "Status unavailable");
            String live = payload.optBoolean("live") ? "Live" : "Not live · retained observations";
            setText(subtitle, live + " · " + state);
            subtitle.setContentDescription(live + " · " + state + ". Tap for complete state and coverage.");
            subtitle.setVisibility(shortLayout ? GONE : VISIBLE);
            subtitle.setTextColor(payload.optBoolean("live") ? SECONDARY : WARNING);
            setOptional(work, chat && !shortLayout ? "Work & coverage  ›" : "");
            work.setMaxLines(1);
            history.setVisibility(GONE);
            work.setContentDescription(payload.optString("workSummary") + ". " + payload.optString("historyNote") + ". Tap for complete work and coverage details.");
            activityFilter.setVisibility("activity".equals(viewName) ? VISIBLE : GONE);
            setText(activityFilter, ("all".equals(payload.optString("activityFilter", "all")) ? "All agents" : payload.optString("activityFilter")) + " · " + payload.optString("activityMode", "live") + "  ▾");
            updateAudio();
            String voiceState = payload.optString("voiceStatus");
            String fullVoiceState = voiceState.isEmpty() ? "Voice status unavailable · text remains readable" : voiceState;
            if (currentAudio() == null) setText(voice, fullVoiceState);
            setText(speed, rateLabel(payload.optDouble("playbackRate", 1)));
            setOptional(reply, payload.optString("replyLabel"));
            replyTop.setVisibility(payload.optString("replyLabel").isEmpty() ? GONE : VISIBLE);
            reply.setMaxLines(compactLayout ? 1 : 3);
            pending.setMaxLines(compactLayout ? 1 : 3);
            replyTop.setContentDescription(payload.optString("replyLabel") + ". Tap for the complete composer, including clear-reply controls.");
            int editorLines = shortLayout ? 1 : compactLayout ? 2 : 4;
            int editorCap = dp(shortLayout ? 72 : compactLayout ? 96 : 112);
            int editorPadding = input.getCompoundPaddingTop() + input.getCompoundPaddingBottom();
            int editorLineHeight = input.getLineHeight();
            while (editorLines > 1 && editorLineHeight * editorLines + editorPadding > editorCap) editorLines--;
            input.setMaxLines(editorLines);
            // TextView.setMaxHeight selects pixel mode and replaces its line
            // bound. Use the actual scaled line metrics rather than a fixed
            // 112dp cap, otherwise compact mode still reserves a giant editor.
            input.setMaxHeight(Math.max(dp(44), Math.min(editorCap, editorLineHeight * editorLines + editorPadding)));
            list.setPadding(dp(6), dp(8), dp(6), dp(shortLayout ? 8 : 12));
            compose.setVisibility(chat ? VISIBLE : GONE);
            String selectedModeLabel = "queue".equals(selectedSendMode) ? "Queue" : "steer".equals(selectedSendMode) ? "Steer" : compactLayout ? "Send" : "Follow-up";
            setText(modeSelector, selectedModeLabel + " ▾");
            modeSelector.setTextColor(color);
            modeSelector.setContentDescription("Send mode: " + ("send".equals(selectedSendMode) ? "Send / follow-up (default)" : selectedModeLabel)
                + ". Tap to choose without submitting. Queue uses the same current follow-up policy; unsupported Steer dispatches nothing.");
            send.setAlpha(capability(selectedSendMode) ? 1 : .55f);
            send.setContentDescription("Send current draft as " + ("send".equals(selectedSendMode) ? "a follow-up" : selectedModeLabel)
                + (capability(selectedSendMode) ? "." : ". This mode is unsupported now; pressing Send retains the draft and dispatches nothing."));
            attach.setAlpha(capability("attachments") ? 1 : .55f);
            boolean recording = payload.optBoolean("recording");
            microphone.setAlpha(recording || capability("voice") ? 1 : .55f);
            icon(microphone, recording ? "stop" : "microphone", recording ? WARNING : SECONDARY);
            microphone.setContentDescription(recording ? "Finish recording and attach voice message" : "Record voice message");
            input.setHint(capability("send") ? "Message" : "Draft · sending currently unavailable");
            for (int i = 0; i < navigation.size(); i++) {
                boolean selected = VIEWS[i].equals(chat ? "chats" : viewName);
                TextView tab = navigation.get(i);
                tab.setTextColor(selected ? ACCENT : SECONDARY);
                tab.setBackground(selected ? outline(withAlpha(ACCENT, 0x25), 12, ACCENT) : null);
                tab.setSelected(selected);
                setText(tab, shortLayout ? "" : compactLayout ? COMPACT_VIEW_LABELS[i] : VIEW_LABELS[i]);
                // An icon-only tab must not reserve an invisible scaled text
                // line. Actual labels retain their full app/system SP scaling.
                tab.setTextSize(shortLayout ? 0 : 11 * appScale);
                tab.setIncludeFontPadding(!shortLayout);
                tab.setCompoundDrawablesWithIntrinsicBounds(null, new Glyph(VIEWS[i], selected ? ACCENT : SECONDARY), null, null);
                tab.setMinHeight(dp(shortLayout ? 44 : 52));
            }
            pinLine.setColor(color);
            pinTitle.setTextColor(color);
            renderPin();
        }

        String incomingDraft = payload.optString("draft");
        // An unchanged remote snapshot must not reset composing text/selection.
        boolean submittedCleared = submittedDraft != null && incomingDraft.isEmpty()
            && input.getText().toString().equals(submittedDraft);
        if ((changedConversation || !input.hasFocus() || submittedCleared) && !input.getText().toString().equals(incomingDraft)) {
            settingDraft = true;
            input.setText(incomingDraft);
            input.setSelection(input.length());
            settingDraft = false;
            if (submittedCleared) submittedDraft = null;
        }
        updatePending();
    }

    private void updatePending() {
        JSONArray attachments = payload.optJSONArray("attachments");
        JSONArray outbox = payload.optJSONArray("outbox");
        String signature = String.valueOf(attachments) + String.valueOf(outbox);
        if (signature.equals(pendingSignature)) return;
        pendingSignature = signature;
        StringBuilder text = new StringBuilder();
        if (attachments != null) for (int i = 0; i < attachments.length(); i++) {
            JSONObject item = attachments.optJSONObject(i);
            if (item == null) continue;
            append(text, item.optString("name", "Attachment") + " · " + item.optString("state", "state unavailable"));
        }
        if (outbox != null) for (int i = 0; i < outbox.length(); i++) {
            JSONObject item = outbox.optJSONObject(i);
            if (item == null) continue;
            String state = item.optString("state", "delivery unconfirmed");
            append(text, "Outbox · " + state + (item.optString("note").isEmpty() ? "" : " · " + item.optString("note")));
        }
        setOptional(pending, text.toString());
        pending.setMaxLines(compactLayout ? 1 : 3);
        pending.setContentDescription(text + ". Tap to open attachment and outbox controls.");
    }

    private void updateRows(boolean changedConversation) {
        final String previousRowContext=rowContext;
        JSONArray content = payload.optJSONArray(chat ? "messages" : "activity".equals(viewName) ? "activity" : "roster");
        JSONArray sessionWork = chat ? payload.optJSONArray("work") : null;
        JSONArray palette = new JSONArray();
        JSONArray roster = payload.optJSONArray("roster");
        if (roster != null) for (int i = 0; i < roster.length(); i++) {
            JSONObject agent = roster.optJSONObject(i);
            if (agent != null) palette.put(new JSONArray().put(agent.optString("id")).put(agent.optString("color")));
        }
        // A row view owns listeners as well as text. Bind reuse to the exact
        // physical conversation/run and formatting context, not a display ID
        // or a hash alone. Audio ticks, draft edits and status-only refreshes
        // deliberately do not invalidate unchanged timeline rows.
        rowContext = new JSONArray().put(viewName).put(chat).put(Float.toString(appScale)).put(Float.toString(nativeFontScale))
            .put(TimeZone.getDefault().getID()).put(Locale.getDefault().toString())
            .put(payload.optString("agent")).put(payload.optString("sessionKey"))
            .put(payload.optString("sessionId")).put(payload.optString("controlRunId"))
            .put(payload.optString("name")).put(payload.optString("color")).put(palette).toString();
        String signature = rowContext + ":" + String.valueOf(content) + ":" + String.valueOf(sessionWork)
            + ":" + String.valueOf(payload.optJSONArray("pins"));
        if (signature.equals(rowsSignature)) return;
        rowsSignature = signature;
        int first = list.getFirstVisiblePosition();
        View top = list.getChildAt(0);
        int offset = top == null ? 0 : top.getTop();
        String anchor = first < adapter.rows.size() ? adapter.rows.get(first).key : "";
        boolean follow = changedConversation || followLive;
        ArrayList<Row> rows = new ArrayList<>();
        if (content != null) for (int i = 0; i < content.length(); i++) {
            JSONObject item = content.optJSONObject(i);
            if (item == null) continue;
            String type = chat ? "message" : "activity".equals(viewName) ? "activity" : "agent";
            if ("message".equals(type) && item.optBoolean("localSubmission")
                && (!payload.optString("agent").equals(item.optString("agent"))
                    || !payload.optString("sessionId").equals(item.optString("sessionId")))) continue;
            String id = item.optString("id", item.optString("messageId", "row-" + i));
            String key = "activity".equals(type) ? activityKey(item, id)
                : "message".equals(type) && item.optBoolean("localSubmission") ? "local-request:" + JSONObject.quote(id) : type + ":" + id;
            rows.add(new Row(key, type, item));
        }
        if (sessionWork != null) for (int i = 0; i < sessionWork.length(); i++) {
            JSONObject event = sessionWork.optJSONObject(i);
            if (event == null) continue;
            rows.add(new Row(activityKey(event, event.optString("id", "work-" + i)), "activity", event));
        }
        if (chat || "activity".equals(viewName)) {
            Collections.sort(rows, Comparator.comparingLong(row -> orderTime(row.value.opt("timestamp"))));
            rows = withDayDividers(rows);
        }
        if (rows.isEmpty()) {
            String note = chat ? "No public messages loaded. History may be partial; this does not prove that no work occurred."
                : "activity".equals(viewName) ? "No operational events loaded. Missing evidence is not an idle or completion receipt."
                : "No agent observations loaded. Check pairing and connection in Settings.";
            rows.add(new Row("empty", "empty", data("text", note)));
        }
        if (chat) rows.add(0, new Row("older", "older", new JSONObject()));
        for (Row row : rows) {
            if ("day".equals(row.type) || "older".equals(row.type) || "empty".equals(row.type)) continue;
            long observedTime = orderTime(row.value.opt("timestamp"));
            if (!changedConversation && !follow && observedTime > 0 && observedTime >= timelineNewestTime && !seenTimelineKeys.contains(row.key)) unreadTimeline++;
            seenTimelineKeys.add(row.key);
        }
        for (Row row : rows) timelineNewestTime = Math.max(timelineNewestTime, orderTime(row.value.opt("timestamp")));
        while (seenTimelineKeys.size() > 4096) seenTimelineKeys.remove(seenTimelineKeys.iterator().next());
        replacingRows = true;
        final ArrayList<RowBinding> beforeBindings=new ArrayList<>();
        for(int n=0;n<adapter.rows.size();n++)beforeBindings.add(adapter.binding(n));
        final ArrayList<Row> beforeRows=new ArrayList<>(adapter.rows);
        adapter.rows.clear();
        adapter.rows.addAll(rows);
        HashSet<String> presentRevisions = new HashSet<>();
        for (Row row : rows) if ("activity".equals(row.type)) presentRevisions.add(expansionKey(row));
        expanded.retainAll(presentRevisions);
        adapter.retainCurrentRowViews();
        final ArrayList<RowBinding> afterBindings=new ArrayList<>();
        for(int n=0;n<adapter.rows.size();n++)afterBindings.add(adapter.binding(n));
        DiffUtil.DiffResult diff=DiffUtil.calculateDiff(new DiffUtil.Callback(){
            public int getOldListSize(){return beforeRows.size();}
            public int getNewListSize(){return adapter.rows.size();}
            public boolean areItemsTheSame(int a,int b){return beforeRows.get(a).key.equals(adapter.rows.get(b).key);}
            public boolean areContentsTheSame(int a,int b){return !changedConversation && previousRowContext.equals(rowContext) && beforeBindings.get(a).equals(afterBindings.get(b));}
        },false);
        diff.dispatchUpdatesTo(adapter);
        final String expectedIdentity = identity;
        if ((chat || "activity".equals(viewName)) && follow) list.post(() -> { if (identity.equals(expectedIdentity)) { jumpToLatest(); replacingRows = false; } });
        else if (!changedConversation && !anchor.isEmpty() && list.getScrollState()==RecyclerView.SCROLL_STATE_IDLE) {
            for (int i = 0; i < rows.size(); i++) if (rows.get(i).key.equals(anchor)) {
                final int position = i;
                list.post(() -> { if (identity.equals(expectedIdentity)) { list.setSelectionFromTop(position, offset); replacingRows = false; updateJump(); } });
                break;
            }
            list.post(() -> { if (identity.equals(expectedIdentity)) replacingRows = false; });
        } else { if (changedConversation) list.setSelection(0); replacingRows = false; }
    }

    /** Dates organize this conversation only; they never become messages or actions. */
    private ArrayList<Row> withDayDividers(List<Row> content) {
        ArrayList<Row> dated = new ArrayList<>();
        String priorDay = null;
        SimpleDateFormat keyFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        DateFormat labelFormat = DateFormat.getDateInstance(DateFormat.FULL);
        for (Row row : content) {
            long millis = orderTime(row.value.opt("timestamp"));
            String day = millis > 0 ? keyFormat.format(new Date(millis)) : "unavailable";
            if (!day.equals(priorDay)) {
                String label = millis > 0 ? labelFormat.format(new Date(millis)) : "Date unavailable";
                dated.add(new Row("day:" + identity + ":" + day, "day", data("text", label)));
                priorDay = day;
            }
            dated.add(row);
        }
        return dated;
    }

    private void renderPin() {
        JSONArray pins = payload.optJSONArray("pins");
        int count = pins == null ? 0 : pins.length();
        pinBar.setVisibility(chat && count > 0 ? VISIBLE : GONE);
        if (count == 0) return;
        pinPosition = Math.max(0, Math.min(pinPosition, count - 1));
        JSONObject pin = pins.optJSONObject(pinPosition);
        if (pin == null) return;
        pinLine.set(pinPosition, count, true);
        String fullTitle = "Pinned message" + (count > 1 ? " · " + (pinPosition + 1) + "/" + count : "")
            + (pin.optBoolean("sourceAvailable", true) ? "" : " · Saved snapshot, not live");
        String preview = pin.optString("title", pin.optString("text", "Pinned message unavailable in this history window"));
        pinTitle.setMaxLines(1);
        pinTitle.setEllipsize(TextUtils.TruncateAt.END);
        setText(pinTitle, compactLayout ? "Pinned" + (count > 1 ? " " + (pinPosition + 1) + "/" + count : "")
            + (pin.optBoolean("sourceAvailable", true) ? " · " : " · Saved · ") + preview : fullTitle);
        setText(pinPreview, preview);
        pinPreview.setVisibility(compactLayout ? GONE : VISIBLE);
        pinBar.setContentDescription(fullTitle + ". " + preview + ". Tap to open; options include pin navigation, history and unpin.");
    }

    private void placePinBanner() {
        int width = getWidth() > 0 ? getWidth() : dp(getResources().getConfiguration().screenWidthDp);
        boolean inline = shortLayout && width >= dp(600);
        ViewGroup target = inline ? heading : shell;
        ViewGroup current = (ViewGroup) pinBar.getParent();
        if (current != target) {
            if (current != null) current.removeView(pinBar);
            if (inline) {
                // Wide landscape can retain the real Telegram pin line/banner
                // beside the chat title without consuming another content row.
                heading.addView(pinBar, 2, new LinearLayout.LayoutParams(Math.min(dp(300), width / 3), -2));
            } else {
                shell.addView(pinBar, 1, new LinearLayout.LayoutParams(-1, -2));
            }
        } else if (inline) {
            LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) pinBar.getLayoutParams();
            int desired = Math.min(dp(300), width / 3);
            if (params.width != desired) {
                params.width = desired;
                pinBar.setLayoutParams(params);
            }
        }
    }

    private JSONObject currentPin() {
        JSONArray pins = payload.optJSONArray("pins");
        return pins == null ? null : pins.optJSONObject(pinPosition);
    }

    private void openCurrentPin() {
        JSONObject pin = currentPin();
        if (pin == null) return;
        navigatePin(pin);
        JSONArray pins = payload.optJSONArray("pins");
        if (pins != null && pins.length() > 1) {
            pinPosition = (pinPosition + 1) % pins.length();
            renderPin();
        }
    }

    private void showPinOptions() {
        final JSONObject origin = scope();
        JSONObject pin = currentPin();
        if (pin == null) {
            showPinHistory();
            return;
        }
        new AlertDialog.Builder(getContext()).setTitle("Pinned messages")
            .setItems(new String[]{"Open this pin", "Next pin", "Pin history", "Unpin this message"}, (dialog, which) -> withScope(origin, () -> {
                if (!sameScope(origin)) { toast("The conversation changed. Reopen pin controls in the intended chat."); return; }
                if (which == 0) navigatePin(pin);
                else if (which == 1) {
                    JSONArray pins = payload.optJSONArray("pins");
                    if (pins != null && pins.length() > 0) pinPosition = (pinPosition + 1) % pins.length();
                    renderPin();
                } else if (which == 2) showPinHistory();
                else emit("unpin", data("id", pin.optString("messageId")));
            })).show();
    }

    private void showPinHistory() {
        final JSONObject origin = scope();
        JSONArray events = payload.optJSONArray("pinHistory");
        if (events == null || events.length() == 0) {
            new AlertDialog.Builder(getContext()).setTitle("Pin history")
                .setMessage("No pin changes are recorded for this conversation.")
                .setPositiveButton("Close", null).show();
            return;
        }
        ArrayList<String> labels = new ArrayList<>();
        ArrayList<JSONObject> records = new ArrayList<>();
        for (int i = 0; i < events.length(); i++) {
            JSONObject item = events.optJSONObject(i);
            if (item == null) continue;
            records.add(item);
            labels.add(item.optString("action", "Pin change") + " · " + item.optString("title", "Message")
                + "\n" + time(item.opt("at")));
        }
        new AlertDialog.Builder(getContext()).setTitle("Pin history · this conversation")
            .setItems(labels.toArray(new String[0]), (dialog, which) -> withScope(origin,
                () -> gotoMessage(records.get(which).optString("messageId"))))
            .setNegativeButton("Close", null).show();
    }

    private void navigatePin(JSONObject pin) {
        if (pin.optBoolean("sourceAvailable", true)) gotoMessage(pin.optString("messageId"));
        else showText("Saved pinned snapshot · not live", pin.optString("text", pin.optString("title", "Pinned message"))
            + "\n\nThe original source is not available in the current history window. This retained snapshot is not a live observation.");
    }

    private void showOptions() {
        ArrayList<String> labels = new ArrayList<>();
        ArrayList<Runnable> commands = new ArrayList<>();
        option(labels, commands, "Search this history", this::showSearch);
        if (chat) {
            option(labels, commands, "Pinned messages", this::showPinOptions);
            option(labels, commands, "Pinned message history", this::showPinHistory);
            option(labels, commands, "Send / Queue / Steer / Stop", this::showSendOptions);
            option(labels, commands, "Files, drafts and outbox", () -> emit("composer"));
            option(labels, commands, "Advanced conversation controls", () -> emit("tools"));
            option(labels, commands, "Commands", () -> emit("commands"));
            option(labels, commands, "Older messages", () -> emit("older"));
        }
        option(labels, commands, "Operational evidence and coverage", () -> emit("details"));
        option(labels, commands, "Audio speed", this::showRates);
        option(labels, commands, "Stop audio", () -> emit("stopAudio"));
        option(labels, commands, "Diagnostics", () -> emit("diagnostics"));
        option(labels, commands, "Export diagnostics", () -> emit("exportDiagnostics"));
        option(labels, commands, "Local WebView inspection…", () -> emit("localInspect"));
        new AlertDialog.Builder(getContext()).setTitle(chat ? payload.optString("name", "Conversation") : "Watch options")
            .setItems(labels.toArray(new String[0]), (dialog, which) -> commands.get(which).run()).show();
    }

    private JSONObject currentAudio() {
        JSONObject audio = payload.optJSONObject("audio");
        if (audio == null || audio.optString("id").isEmpty()
            || !payload.optString("agent").equals(audio.optString("agent"))
            || !payload.optString("sessionId").equals(audio.optString("sessionId"))) return null;
        return audio;
    }

    private void updateAudio() {
        JSONObject audio = currentAudio();
        String state = audio == null ? "idle" : audio.optString("state", "idle");
        boolean present = chat && audio != null && !state.isEmpty() && !"idle".equals(state)
            && !"stopped".equals(state) && !"ended".equals(state);
        audioPanel.setVisibility(present ? VISIBLE : GONE);
        if (!present) return;
        String label = audio.optString("label", "Report audio");
        String source = "recording".equals(audio.optString("source")) ? "Recording" : "Read aloud";
        String progress = "";
        Object supplied = audio.opt("progress");
        if (supplied instanceof Number) progress = " · " + Math.max(0, Math.min(100, ((Number)supplied).intValue())) + "%";
        else if (supplied instanceof JSONObject) progress = " · " + Math.max(0, Math.min(100, ((JSONObject)supplied).optInt("percent"))) + "%";
        String report = audio.optString("messageId");
        String reportLabel = report.length() > 16 ? report.substring(report.length() - 16) : report;
        setText(voice, source + " · " + label + " · " + reportLabel + " · " + state + progress
            + ("preparing".equals(state) || "loading".equals(state) || "downloading".equals(state) ? " · " + clock(audio.optLong("elapsedMs")) + " elapsed" : ""));
        voice.setContentDescription(source + ". " + label + ". " + state + ". Exact report " + audio.optString("messageId"));
        setText(pauseAudio, "paused".equals(state) ? "Resume" : "Pause");
        pauseAudio.setEnabled(audio.optBoolean("canPause") && ("paused".equals(state) || "playing".equals(state)));
        long duration = Math.max(0, audio.optLong("durationMs"));
        long position = Math.max(0, Math.min(duration, audio.optLong("positionMs")));
        setText(audioTime, clock(position) + " / " + (duration > 0 ? clock(duration) : "–:––"));
        audioSeek.setEnabled(audio.optBoolean("canSeek") && duration > 0);
        if (!seekingAudio) audioSeek.setProgress(duration > 0 ? (int)(position * 1000 / duration) : 0);
    }

    private static String clock(long millis) {
        long seconds = Math.max(0, millis / 1000);
        return String.format(Locale.ROOT, "%d:%02d", seconds / 60, seconds % 60);
    }

    private void showActivityFilter() {
        if (!"activity".equals(viewName)) return;
        String[] ids = {"all", "main", "forge", "atlas", "aera-new", "vvv", "daedalus"};
        String[] labels = {"All agents", "Commander", "FORGE", "ATLAS", "Æra", "VVV", "Daedalus"};
        final String expectedIdentity = identity;
        new AlertDialog.Builder(getContext()).setTitle("Activity agent")
            .setItems(labels, (dialog, which) -> {
                if (identity.equals(expectedIdentity)) emit("activityFilter", data("agent", ids[which]));
            }).setNeutralButton("Timeline mode", (dialog, which) -> {
                if (!identity.equals(expectedIdentity)) return;
                new AlertDialog.Builder(getContext()).setTitle("Activity mode")
                    .setItems(new String[]{"Live", "Work details"}, (choice, index) -> {
                        if (identity.equals(expectedIdentity)) emit("activityMode", data("mode", index == 0 ? "live" : "work"));
                    }).show();
            }).setNegativeButton("Close", null).show();
    }

    private void showWorkCoverage() {
        StringBuilder content = new StringBuilder();
        append(content, payload.optBoolean("live") ? "Live observations" : "Not live · retained observations");
        append(content, payload.optString("status", "Status unavailable"));
        append(content, "Observed: " + time(payload.opt("observedAt")));
        append(content, "\nWork\n" + payload.optString("workSummary", "No work summary supplied."));
        append(content, "\nCoverage\n" + payload.optString("historyNote", "History coverage not supplied."));
        showText("Work, state and coverage", content.toString());
    }

    private void showSendOptions() {
        final JSONObject origin = scope();
        String steerLabel = capability("steer") ? "Steer this exact active run" : "Steer unavailable · not dispatched";
        new AlertDialog.Builder(getContext()).setTitle("Run controls")
            .setItems(new String[]{"Send / follow-up · default", "Queue · same current follow-up policy", steerLabel,
                capability("abort") ? "Stop the observed run" : "Stop unavailable for the observed run",
                "Files, outbox and advanced tools", "Commands"}, (dialog, which) -> withScope(origin, () -> {
                if (!sameScope(origin) || which <= 3 && !origin.optString("runId").equals(payload.optString("controlRunId"))) {
                    toast("The conversation or observed run changed. Reopen its controls. Nothing was dispatched.");
                    return;
                }
                if (which == 0) selectSendMode("send");
                else if (which == 1) selectSendMode("queue");
                else if (which == 2) selectSendMode("steer");
                else if (which == 3) available("abort", "stop", "No supported Stop target is currently observed. Nothing was dispatched.");
                else if (which == 4) emit("composer");
                else emit("commands");
            })).show();
    }

    private void selectSendMode(String mode) {
        selectedSendMode = mode;
        updateChrome(false);
        if ("steer".equals(mode) && !capability("steer")) {
            toast("Exact-run steering is unsupported. The draft is retained; nothing was queued or dispatched. Choose Follow-up separately if wanted.");
        }
    }

    private void sendMode(String mode) {
        if (!capability(mode)) {
            toast("steer".equals(mode) ? "Exact-run steering is unsupported. Nothing was queued or dispatched."
                : "This action is unavailable in the current observed state. Your draft is retained.");
            return;
        }
        String visibleDraft = input.getText().toString();
        if (visibleDraft.length() > 16000) {
            toast("This draft exceeds 16,000 characters. Nothing was sent or truncated; shorten the draft or attach it as a file.");
            return;
        }
        submittedDraft = visibleDraft;
        emit("draft", data("text", submittedDraft));
        JSONObject request = data("mode", mode);
        try { request.put("text", visibleDraft); } catch (JSONException ignored) { }
        emit("send", request);
        // Only the authoritative returned draft/custody state can clear input.
    }

    private void showRates() {
        final JSONObject origin = scope();
        String[] labels = new String[RATES.length];
        int selected = 2;
        double current = payload.optDouble("playbackRate", 1);
        for (int i = 0; i < RATES.length; i++) {
            labels[i] = rateLabel(RATES[i]);
            if (Math.abs(current - RATES[i]) < .001) selected = i;
        }
        new AlertDialog.Builder(getContext()).setTitle("Audio speed · pitch preserved")
            .setSingleChoiceItems(labels, selected, (dialog, which) -> {
                withScope(origin, () -> emit("speed", data("rate", RATES[which])));
                dialog.dismiss();
            }).setNegativeButton("Cancel", null).show();
    }

    private void showSearch() {
        final JSONObject origin = scope();
        EditText search = new EditText(getContext());
        search.setSingleLine(true);
        search.setHint("Search loaded public history");
        search.setPadding(dp(20), dp(12), dp(20), dp(12));
        new AlertDialog.Builder(getContext()).setTitle("Search")
            .setView(search).setPositiveButton("Search", (dialog, which) -> withScope(origin,
                () -> emit("search", data("text", search.getText().toString()))))
            .setNegativeButton("Cancel", null).show();
    }

    private void messageOptions(JSONObject message, JSONObject origin) {
        if (!sameScope(origin)) {
            toast("The conversation changed. Reopen this message in its original chat. Nothing was dispatched.");
            return;
        }
        String id = message.optString("id");
        if (id.isEmpty()) {
            toast("This record has no actionable message identity.");
            return;
        }
        ArrayList<String> labels = new ArrayList<>();
        ArrayList<Runnable> commands = new ArrayList<>();
        boolean local = message.optBoolean("localSubmission");
        option(labels, commands, local ? "Full original request" : "Formatted text and links", () -> emit("full", messageData(message)));
        if (!local && message.optBoolean("canReply")) {
            option(labels, commands, "Reply", () -> emit("reply", data("id", id)));
        }
        if (!local && message.optBoolean("canPin")) {
            final boolean pinned = isPinned(id);
            option(labels, commands, pinned ? "Unpin" : "Pin message", () -> emit(pinned ? "unpin" : "pin", data("id", id)));
        }
        if (!message.optString("text").isEmpty()) {
            option(labels, commands, "Copy full text", () -> emit("copy", messageData(message)));
            option(labels, commands, "Share full text", () -> emit("share", messageData(message)));
        }
        if (!local && message.optBoolean("canRead")) {
            option(labels, commands, "Read aloud in the agent's approved voice", () -> emit("read", data("id", id)));
        }
        JSONArray media = local ? null : message.optJSONArray("media");
        if (media != null) for (int i = 0; i < media.length(); i++) {
            JSONObject item = media.optJSONObject(i);
            if (item == null) continue;
            final int index = item.optInt("index", i);
            final boolean available = item.optBoolean("available");
            final String unavailableReason = item.optString("unavailableReason", "No authenticated playable download is available for this attachment. Nothing was played.");
            String label = item.optString("label", "Attachment");
            option(labels, commands, available ? "Open " + label : label + " · unavailable", () -> {
                if (available) emit("media", mediaData(id, index));
                else toast(unavailableReason);
            });
        }
        if (!local && !message.optString("replyToId").isEmpty()) {
            option(labels, commands, "Show linked readable message", () -> gotoMessage(message.optString("replyToId")));
        }
        if (labels.isEmpty()) {
            toast("This record has no readable text or playable attachment. Delivery remains incomplete.");
            return;
        }
        new AlertDialog.Builder(getContext()).setTitle(local ? "Original local request" : "Message actions")
            .setItems(labels.toArray(new String[0]), (dialog, which) -> commands.get(which).run()).show();
    }

    private boolean isPinned(String id) {
        JSONArray pins = payload.optJSONArray("pins");
        if (pins != null) for (int i = 0; i < pins.length(); i++) {
            JSONObject pin = pins.optJSONObject(i);
            if (pin != null && id.equals(pin.optString("messageId"))) return true;
        }
        return false;
    }

    private void gotoMessage(String id) {
        if (id == null || id.isEmpty()) {
            toast("The linked message identity is unavailable.");
            return;
        }
        for (int i = 0; (actionScope == null || sameScope(actionScope)) && i < adapter.rows.size(); i++) {
            Row row = adapter.rows.get(i);
            if (!row.value.optBoolean("localSubmission") && id.equals(row.value.optString("id"))) {
                list.smoothScrollToPositionFromTop(i, dp(12));
                return;
            }
        }
        emit("goto", data("id", id));
    }

    private void focusRequestedMessage() {
        final String id = payload.optString("focusMessageId");
        if (id.isEmpty()) {
            lastFocusMessage = "";
            return;
        }
        if (id.equals(lastFocusMessage)) return;
        for (int i = 0; i < adapter.rows.size(); i++) {
            if (!adapter.rows.get(i).value.optBoolean("localSubmission") && id.equals(adapter.rows.get(i).value.optString("id"))) {
                final int position = i;
                final String expectedIdentity = identity;
                lastFocusMessage = id;
                list.post(() -> {
                    if (identity.equals(expectedIdentity)) list.setSelectionFromTop(position, dp(12));
                });
                return;
            }
        }
        // A later same-scope history update may supply the requested source.
    }

    private void jumpToLatest() {
        if (adapter.rows.isEmpty()) return;
        list.scrollToPosition(adapter.rows.size() - 1);
        listAtEnd = true;
        followLive = true; unreadTimeline = 0;
        updateJump();
    }

    private void updateJump() {
        // ListView invokes its scroll listener immediately when registered,
        // before the constructor has created the overlay control.
        if (jump == null) return;
        setText(jump, "activity".equals(viewName) ? "↓ Resume live" + (unreadTimeline > 0 ? " · " + unreadTimeline + " new" : "") : "↓ Latest" + (unreadTimeline > 0 ? " · " + unreadTimeline + " new" : ""));
        jump.setVisibility(showing() && (chat || "activity".equals(viewName)) && !listAtEnd ? VISIBLE : GONE);
    }

    private final class SurfaceAdapter extends TimelineView.Adapter {
        final ArrayList<Row> rows = new ArrayList<>();
        // Own only discarded convertViews handed to getView, never returned
        // views that ListView may still hold in its own recycler. Exact rows
        // can reclaim their selectable text/bubbles/controls on a later pass.
        private static final int MAX_ROW_VIEWS = 24;
        private final LinkedHashMap<RowBinding, View> rowViews = new LinkedHashMap<>(32, .75f, true);

        void clearRowViews() { rowViews.clear(); }

        private RowBinding binding(int position) {
            Row row = rows.get(position);
            boolean outgoing = row.value.optBoolean("localSubmission") || "user".equals(row.value.optString("role"));
            boolean message = "message".equals(row.type);
            return new RowBinding(rowContext, row, "activity".equals(row.type) && expanded.contains(expansionKey(row)), isPinned(row.value.optString("id")),
                message && adjacentMessage(position, -1, outgoing), message && adjacentMessage(position, 1, outgoing));
        }

        void retainCurrentRowViews() {
            HashSet<RowBinding> current = new HashSet<>();
            for (int i = 0; i < rows.size(); i++) current.add(binding(i));
            rowViews.keySet().retainAll(current);
        }

        private void remember(RowBinding binding, View view) {
            rowViews.put(binding, view);
            while (rowViews.size() > MAX_ROW_VIEWS) rowViews.remove(rowViews.keySet().iterator().next());
        }

        @Override public int getCount() { return rows.size(); }
        @Override public Object getItem(int position) { return rows.get(position); }
        @Override public long getItemId(int position) { return stableId(rows.get(position).key); }
        SurfaceAdapter() { setHasStableIds(true); }
        @Override public boolean areAllItemsEnabled() { return false; }
        @Override public boolean isEnabled(int position) {
            String type = rows.get(position).type;
            return !"day".equals(type) && !"empty".equals(type);
        }
        @Override public int getViewTypeCount() { return 6; }
        @Override public int getItemViewType(int position) {
            String type = rows.get(position).type;
            return "message".equals(type) ? 0 : "activity".equals(type) ? 1 : "agent".equals(type) ? 2 : "older".equals(type) ? 3 : "day".equals(type) ? 5 : 4;
        }

        @Override public View getView(int position, View recycled, ViewGroup parent) {
            Row row = rows.get(position);
            RowBinding fingerprint = binding(position);
            if (recycled != null && fingerprint.equals(recycled.getTag())) return recycled;
            if (recycled != null && recycled.getParent() == null && recycled.getTag() instanceof RowBinding)
                remember((RowBinding)recycled.getTag(), recycled);
            View cached = rowViews.remove(fingerprint);
            // Never steal a view still owned by ListView or another parent.
            if (cached != null && cached.getParent() == null) return cached;
            View result;
            if ("message".equals(row.type)) result = messageRow(row, position);
            else if ("activity".equals(row.type)) result = activityRow(row);
            else if ("agent".equals(row.type)) result = agentRow(row);
            else if ("day".equals(row.type)) {
                TextView day = text(12, SECONDARY, true);
                day.setText(row.value.optString("text", "Date unavailable"));
                day.setContentDescription("Conversation date: " + day.getText());
                day.setGravity(Gravity.CENTER);
                day.setPadding(dp(10), dp(10), dp(10), dp(6));
                result = day;
            }
            else if ("older".equals(row.type)) {
                TextView older = text(13, ACCENT, true);
                older.setText("Load older messages");
                older.setGravity(Gravity.CENTER);
                older.setPadding(dp(10), dp(10), dp(10), dp(10));
                older.setOnClickListener(v -> emit("older"));
                result = older;
            } else {
                TextView empty = text(15, SECONDARY, false);
                empty.setText(row.value.optString("text"));
                empty.setPadding(dp(20), dp(24), dp(20), dp(24));
                result = empty;
            }
            result.setTag(fingerprint);
            result.setTag(TAG_ROW_KEY, row.key);
            return result;
        }
    }

    private View agentRow(Row row) {
        JSONObject agent = row.value;
        LinearLayout outer = horizontal();
        outer.setPadding(dp(10), dp(14), dp(8), dp(14));
        int accent = agentColor(agent.optString("id"));
        outer.setBackground(outline(tint(PANEL, accent, .08f), 12, tint(0xff424242, accent, .55f)));
        TextView avatar = text(22, accent, true);
        String name = agent.optString("name", agent.optString("id", "Agent"));
        avatar.setText(name.isEmpty() ? "?" : name.substring(0, 1));
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(outline(tint(PANEL_LIGHT, accent, .1f), 28, accent));
        outer.addView(avatar, new LinearLayout.LayoutParams(dp(52), dp(52)));
        LinearLayout content = vertical();
        content.setPadding(dp(13), 0, 0, 0);
        TextView nameView = text(17, accent, true);
        nameView.setText(name);
        TextView state = text(12, SECONDARY, false);
        state.setText(agent.optString("status", "Status unavailable"));
        TextView preview = text(14, SECONDARY, false);
        preview.setText(agent.optString("preview", "No public report available"));
        preview.setMaxLines(3);
        preview.setEllipsize(TextUtils.TruncateAt.END);
        content.addView(nameView);
        content.addView(state);
        content.addView(preview);
        outer.addView(content, new LinearLayout.LayoutParams(0, -2, 1));
        outer.setContentDescription(name + ". " + state.getText() + ". " + preview.getText());
        outer.setOnClickListener(v -> emit("openChat", data("agent", agent.optString("id"))));
        return outer;
    }

    private View messageRow(Row row, int position) {
        JSONObject message = row.value;
        final boolean local = message.optBoolean("localSubmission");
        final JSONObject origin = scope();
        final String actionTag = local ? "telegram-local-" : "telegram-";
        boolean outgoing = local || "user".equals(message.optString("role"));
        LinearLayout outer = vertical();
        outer.setGravity(outgoing ? Gravity.END : Gravity.START);
        outer.setPadding(outgoing ? dp(24) : dp(2), dp(3), outgoing ? dp(2) : dp(24), dp(3));
        LinearLayout bubble = vertical();
        bubble.setPadding(dp(13), dp(9), dp(13), dp(8));
        int accent = agentColor(payload.optString("agent"));
        MessageDrawable background = new MessageDrawable(getContext(), outgoing,
            outgoing ? tint(INCOMING, accent, .07f) : INCOMING);
        background.setAdjacent(adjacentMessage(position, -1, outgoing), adjacentMessage(position, 1, outgoing));
        bubble.setBackground(background);
        outer.addView(bubble, new LinearLayout.LayoutParams(-2, -2));

        String kind = message.optString("kind");
        String role = outgoing ? "You" : payload.optString("name", "Agent");
        if (!local && isPinned(message.optString("id"))) role += " · Pinned";
        if (local) role += " · Local request";
        else if (!kind.isEmpty()) role += " · " + kind;
        TextView author = text(11, outgoing ? TEXT : accent, true);
        author.setText(role);
        bubble.addView(author);

        String fullText = message.optString("text");
        String missingText = message.optString("deliveryDiagnosis");
        if (missingText.isEmpty()) missingText = "Readable report text unavailable. An attachment does not prove a companion text reply.";
        TextView content = text(16, TEXT, false);
        content.setText(fullText.isEmpty() ? local ? message.optString("attachmentNote", "Attachment submission · contents not attested")
            : missingText : fullText);
        content.setTextColor(fullText.isEmpty() && !local ? WARNING : TEXT);
        content.setTextIsSelectable(true);
        content.setPadding(0, dp(4), 0, dp(5));
        content.setOnLongClickListener(v -> {
            messageOptions(message, origin);
            return true;
        });
        bubble.addView(content);
        if (local) {
            TextView admission = text(12, SECONDARY, false);
            admission.setTag("telegram-local-submission-" + message.optString("id"));
            admission.setText(submissionNote(message));
            admission.setTextIsSelectable(true);
            admission.setPadding(0, dp(2), 0, dp(5));
            bubble.addView(admission);
        }
        if (message.optBoolean("truncated") || message.optBoolean("fullAvailable")) {
            TextView limited = text(12, WARNING, false);
            limited.setText(local ? "Original request preview is bounded; open its full exact body below."
                : "Native preview is bounded; open the full exact message below.");
            bubble.addView(limited);
            Button full = button(local ? "Show full original request" : "Show full message", "Open complete readable text for this exact message");
            full.setTag(actionTag + "full-" + message.optString("id"));
            full.setOnClickListener(v -> emitMessage("full", message, origin));
            bubble.addView(full);
        }

        JSONArray media = local ? null : message.optJSONArray("media");
        if (media != null) for (int i = 0; i < media.length(); i++) {
            JSONObject item = media.optJSONObject(i);
            if (item == null) continue;
            final int index = item.optInt("index", i);
            final boolean available = item.optBoolean("available");
            final String unavailableReason = item.optString("unavailableReason", "No authenticated playable download is available. This is not a working audio control.");
            Button mediaButton = button(item.optString("label", "Attachment") + (available ? " · Open" : " · Unavailable"),
                available ? "Open authenticated attachment" : "Attachment has no usable authenticated download");
            mediaButton.setTextColor(available ? accent : WARNING);
            mediaButton.setTag("telegram-media-" + message.optString("id") + "-" + index);
            mediaButton.setOnClickListener(v -> {
                if (!sameScope(origin)) { toast("The conversation changed. Nothing was played."); return; }
                if (available) withScope(origin, () -> emit("media", mediaData(message.optString("id"), index)));
                else toast(unavailableReason);
            });
            bubble.addView(mediaButton, new LinearLayout.LayoutParams(-1, -2));
        }
        String replyTo = message.optString("replyToId");
        if (!local && !replyTo.isEmpty()) {
            Button linked = button("Show linked text", "Navigate to independently readable linked message");
            linked.setOnClickListener(v -> { if (sameScope(origin)) withScope(origin, () -> gotoMessage(replyTo)); });
            bubble.addView(linked);
        }
        String delivery = local ? "" : delivery(message.opt("delivery"));
        if (!delivery.isEmpty()) {
            TextView receipt = text(11, SECONDARY, false);
            receipt.setText(delivery);
            receipt.setTextIsSelectable(true);
            bubble.addView(receipt);
        }
        LinearLayout meta = horizontal();
        TextView stamp = text(11, SECONDARY, false);
        stamp.setText(time(message.opt("timestamp")));
        meta.addView(stamp, new LinearLayout.LayoutParams(0, -2, 1));
        Button menu = button("⋮", local ? "Full original request, copy and share actions" : "Reply, pin, copy and media actions");
        menu.setTag(actionTag + "message-actions-" + message.optString("id"));
        menu.setOnClickListener(v -> messageOptions(message, origin));
        meta.addView(menu, new LinearLayout.LayoutParams(dp(40), -2));
        bubble.addView(meta);
        outer.setOnLongClickListener(v -> {
            messageOptions(message, origin);
            return true;
        });
        return outer;
    }

    private boolean adjacentMessage(int position, int direction, boolean outgoing) {
        int other = position + direction;
        if (other < 0 || other >= adapter.rows.size()) return false;
        Row row = adapter.rows.get(other);
        return "message".equals(row.type) && outgoing == (row.value.optBoolean("localSubmission") || "user".equals(row.value.optString("role")));
    }

    private View activityRow(Row row) {
        JSONObject event = row.value;
        LinearLayout outer = vertical();
        outer.setPadding(dp(7), dp(5), dp(7), dp(5));
        LinearLayout card = vertical();
        int accent = agentColor(event.optString("agent"));
        card.setBackground(outline(PANEL, 12, tint(0xff424242, accent, .55f)));
        card.setPadding(dp(12), dp(10), dp(12), dp(10));
        outer.addView(card, new LinearLayout.LayoutParams(-1, -2));
        TextView heading = text(13, accent, true);
        heading.setText(event.optString("name", event.optString("agent", "Agent")) + " · "
            + event.optString("kind", "Operational observation") + " · " + time(event.opt("timestamp")));
        card.addView(heading);
        TextView summary = text(15, TEXT, false);
        String preview = event.optString("preview");
        if (preview.isEmpty()) preview = event.optString("text", "Summary unavailable; no outcome inferred.");
        if (preview.length() > 2000) preview = preview.substring(0, 2000) + "\n[Inline preview limited; expand the supplied observation below.]";
        summary.setText(preview);
        summary.setTag("telegram-operation-preview-" + event.optString("id"));
        summary.setTextIsSelectable(true);
        summary.setPadding(0, dp(5), 0, dp(5));
        card.addView(summary);
        JSONArray steps = event.optJSONArray("steps");
        if (steps != null && steps.length() > 0) {
            TextView checklistTitle = text(13, accent, true);
            checklistTitle.setText("Reported task checklist");
            card.addView(checklistTitle);
            for (int i = 0; i < Math.min(32, steps.length()); i++) {
                JSONObject step = steps.optJSONObject(i);
                if (step == null) continue;
                String label = step.optString("step");
                if (label.isEmpty()) continue;
                if (label.length() > 320) label = label.substring(0, 320) + "…";
                String status = step.optString("status");
                String marker = "completed".equals(status) ? "[✓] " : "in_progress".equals(status) ? "[→] " : "[ ] ";
                TextView stepView = text(14, "in_progress".equals(status) ? TEXT : SECONDARY, false);
                stepView.setText(marker + label + ("in_progress".equals(status) ? " · reported current step" : ""));
                stepView.setTag("telegram-step-" + event.optString("id") + "-" + i);
                stepView.setTextIsSelectable(true);
                stepView.setPadding(0, dp(3), 0, dp(3));
                card.addView(stepView);
            }
            if (steps.length() > 32) {
                TextView limited = text(12, WARNING, false);
                limited.setText("Reported checklist is bounded to 32 supplied steps.");
                card.addView(limited);
            }
        }
        String details = detail(event.opt("detail"));
        String revision = event.optString("revision");
        String expansionKey = expansionKey(row);
        if (!details.isEmpty()) {
            Button toggle = button(expanded.contains(expansionKey) ? "Hide evidence" : "Expand evidence", "Expand this same-revision operational observation");
            toggle.setTag("telegram-expand-" + event.optString("id"));
            toggle.setOnClickListener(v -> {
                if (expanded.contains(expansionKey)) expanded.remove(expansionKey);
                else expanded.add(expansionKey);
                int first = list.getFirstVisiblePosition(); View top = list.getChildAt(0);
                int offset = top == null ? 0 : top.getTop(); final String expectedIdentity = identity;
                replacingRows = true; followLive = false;
                adapter.notifyDataSetChanged();
                list.post(() -> { if (identity.equals(expectedIdentity)) { list.setSelectionFromTop(first, offset); replacingRows = false; listAtEnd = false; updateJump(); } });
            });
            card.addView(toggle);
            if (expanded.contains(expansionKey)) {
                TextView evidence = text(13, SECONDARY, false);
                evidence.setText(details + (revision.isEmpty() ? "\nRevision unavailable" : "\nObservation revision: " + revision));
                evidence.setTextIsSelectable(true);
                evidence.setTag("telegram-evidence-" + event.optString("id"));
                card.addView(evidence);
            }
        }
        if (event.optBoolean("ownerDetail") && !event.optBoolean("stale") && !revision.isEmpty()) {
            final String expectedIdentity = identity;
            Button owner = button("Full recorded operation", "Read this exact owner-bound operation and result, excluding private model reasoning");
            owner.setTag("telegram-owner-detail-" + event.optString("id"));
            owner.setOnClickListener(v -> {
                if (!identity.equals(expectedIdentity) || !currentObservedRevision(row.key, expansionKey)) {
                    toast("This exact observation changed. Refresh and reopen its recorded operation."); return;
                }
                JSONObject value = data("id", event.optString("id"));
                try { value.put("agent", event.optString("agent")); value.put("sessionId", event.optString("sessionId")); value.put("revision", revision); } catch (JSONException ignored) { }
                emit("ownerDetail", value);
            });
            card.addView(owner);
        }
        if (!chat && !event.optString("agent").isEmpty()) {
            Button open = button("Open agent chat", "Open this event's agent conversation before using chat-scoped controls");
            open.setOnClickListener(v -> emit("openChat", data("agent", event.optString("agent"))));
            card.addView(open);
        }
        if (chat && event.optBoolean("canPin")
            && payload.optString("agent").equals(event.optString("agent"))
            && payload.optString("sessionId").equals(event.optString("sessionId"))) {
            final JSONObject origin = scope();
            final String expectedRevision = expansionKey(row);
            Button pin = button(isPinned(event.optString("id")) ? "Unpin activity" : "Pin activity", "Pin this exact owned operational observation");
            pin.setTag("telegram-pin-work-" + event.optString("id"));
            pin.setOnClickListener(v -> {
                if (!sameScope(origin) || !currentWorkRevision(row.key, expectedRevision)) {
                    toast("This operational observation changed or became unavailable. Reopen its current revision before pinning.");
                    return;
                }
                JSONObject data = data("id", event.optString("id"));
                try { data.put("revision", event.optString("revision")); } catch (JSONException ignored) { }
                withScope(origin, () -> emit(isPinned(event.optString("id")) ? "unpin" : "pin", data));
            });
            card.addView(pin);
        }
        return outer;
    }

    private boolean currentWorkRevision(String key, String expectedRevision) {
        JSONArray events = payload.optJSONArray("work");
        if (events == null) return false;
        for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.optJSONObject(i);
            if (event == null || !event.optBoolean("canPin")) continue;
            String currentKey = activityKey(event, event.optString("id", "work-" + i));
            if (key.equals(currentKey) && expectedRevision.equals(expansionKey(new Row(currentKey, "activity", event)))) return true;
        }
        return false;
    }

    private boolean currentObservedRevision(String key, String expectedRevision) {
        JSONArray events = payload.optJSONArray(chat ? "work" : "activity");
        if (events == null) return false;
        for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.optJSONObject(i);
            if (event == null || !event.optBoolean("ownerDetail") || event.optBoolean("stale")) continue;
            String currentKey = activityKey(event, event.optString("id", "work-" + i));
            if (key.equals(currentKey) && expectedRevision.equals(expansionKey(new Row(currentKey, "activity", event)))) return true;
        }
        return false;
    }

    private static final class Row {
        final String key;
        final String type;
        final JSONObject value;
        final String content;
        final String expansion;
        Row(String key, String type, JSONObject value) {
            this.key = key;
            this.type = type;
            // Snapshot once per changed timeline, not on every getView call.
            // The bridge may mutate/reuse its model after rendering; a cached
            // listener must retain the exact record it was created against.
            this.content = value.toString();
            try { this.value = new JSONObject(content); }
            catch (JSONException error) { throw new IllegalArgumentException("Invalid timeline row", error); }
            String revision = this.value.optString("revision");
            this.expansion = "activity".equals(type) ? key + ":revision:"
                + (revision.isEmpty() ? "unavailable:" + content : revision) : "";
        }
    }

    private static final class RowBinding {
        final String context, key, type, content;
        final boolean expanded, pinned, before, after;
        final int hash;
        RowBinding(String context, Row row, boolean expanded, boolean pinned, boolean before, boolean after) {
            this.context = context; this.key = row.key; this.type = row.type; this.content = row.content;
            this.expanded = expanded; this.pinned = pinned; this.before = before; this.after = after;
            int value = context.hashCode();
            value = 31 * value + key.hashCode(); value = 31 * value + type.hashCode(); value = 31 * value + content.hashCode();
            value = 31 * value + (expanded ? 1 : 0); value = 31 * value + (pinned ? 1 : 0);
            value = 31 * value + (before ? 1 : 0); hash = 31 * value + (after ? 1 : 0);
        }
        @Override public int hashCode() { return hash; }
        @Override public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof RowBinding)) return false;
            RowBinding that = (RowBinding) other;
            return expanded == that.expanded && pinned == that.pinned && before == that.before && after == that.after
                && context.equals(that.context) && key.equals(that.key) && type.equals(that.type) && content.equals(that.content);
        }
    }

    private static String expansionKey(Row row) {
        return row.expansion;
    }

    private static String activityKey(JSONObject event, String id) {
        // Native record/call IDs are not globally unique across agents or
        // physical sessions. Escaped tuple fields also prevent separator aliases.
        return "activity:" + JSONObject.quote(event.optString("agent")) + ":"
            + JSONObject.quote(event.optString("sessionId")) + ":" + JSONObject.quote(id);
    }

    private boolean capability(String name) {
        JSONObject can = payload.optJSONObject("can");
        return can != null && can.optBoolean(name, false);
    }

    private void available(String capability, String action, String refusal) {
        if (capability(capability)) emit(action);
        else toast(refusal);
    }

    private void emit(String action) {
        emit(action, new JSONObject());
    }

    private void emit(String action, JSONObject data) {
        if (actions == null) {
            toast("The native Watch action bridge is unavailable. Nothing was dispatched.");
            return;
        }
        JSONObject origin = actionScope == null ? scope() : actionScope;
        try {
            if ("openChat".equals(action)) data.put("sourceAgent", origin.optString("agent"));
            else if (!"activityFilter".equals(action) && !"ownerDetail".equals(action)) data.put("agent", origin.optString("agent"));
            if (!"ownerDetail".equals(action)) {
                data.put("sessionKey", origin.optString("sessionKey"));
                data.put("sessionId", origin.optString("sessionId"));
            }
            if ("stop".equals(action) || "send".equals(action) && "steer".equals(data.optString("mode"))) {
                data.put("runId", origin.optString("runId"));
            }
        } catch (JSONException ignored) { }
        actions.send(action, data);
    }

    private void emitMessage(String action, JSONObject message, JSONObject origin) {
        if (!sameScope(origin)) {
            toast("The conversation changed. Reopen this message in its original chat. Nothing was dispatched.");
            return;
        }
        if (message.optBoolean("localSubmission")
            && !"full".equals(action) && !"copy".equals(action) && !"share".equals(action)) return;
        withScope(origin, () -> emit(action, messageData(message)));
    }

    private void showText(String heading, String value) {
        TextView content = text(15, TEXT, false);
        content.setText(value);
        content.setTextIsSelectable(true);
        content.setPadding(dp(20), dp(16), dp(20), dp(16));
        android.widget.ScrollView scroll = new android.widget.ScrollView(getContext());
        scroll.addView(content);
        new AlertDialog.Builder(getContext()).setTitle(heading).setView(scroll).setPositiveButton("Close", null).show();
    }

    private void toast(String value) {
        Toast.makeText(getContext(), value, Toast.LENGTH_LONG).show();
    }

    private void option(List<String> labels, List<Runnable> commands, String label, Runnable command) {
        labels.add(label);
        final JSONObject origin = scope();
        commands.add(() -> {
            if (!sameScope(origin)) {
                toast("The conversation changed. Reopen controls in the intended chat. Nothing was dispatched.");
                return;
            }
            withScope(origin, command);
        });
    }

    private TextView text(float size, int color, boolean bold) {
        TextView result = new TextView(getContext());
        result.setTextColor(color);
        result.setTextSize(size);
        baseTextSizes.put(result, size);
        result.setTextSize(size * appScale);
        result.setIncludeFontPadding(true);
        result.setLineSpacing(dp(1), 1);
        if (bold) result.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return result;
    }

    private Button button(String label, String description) {
        Button result = new Button(getContext());
        result.setText(label);
        result.setContentDescription(description);
        result.setTextSize(13);
        baseTextSizes.put(result, 13f);
        result.setTextSize(13 * appScale);
        result.setTextColor(SECONDARY);
        result.setAllCaps(false);
        result.setMinWidth(0);
        result.setMinimumWidth(0);
        result.setMinHeight(dp(40));
        result.setMinimumHeight(dp(40));
        result.setPadding(dp(9), dp(5), dp(9), dp(5));
        result.setBackground(round(Color.TRANSPARENT, 14));
        return result;
    }

    private void icon(Button button, String name, int color) {
        button.setText("");
        // This control has a real drawable and accessible name, not a tiny
        // text glyph; remove only its phantom empty text-line measurement.
        button.setTextSize(0);
        button.setIncludeFontPadding(false);
        baseTextSizes.put(button, 0f);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(9), dp(9), dp(9), dp(9));
        button.setMinWidth(dp(42));
        button.setMinimumWidth(dp(42));
        button.setMinHeight(dp(44));
        button.setMinimumHeight(dp(44));
        button.setCompoundDrawablesWithIntrinsicBounds(new Glyph(name, color), null, null, null);
    }

    /** Small native vector controls remain legible targets without shrinking scaled text. */
    private final class Glyph extends Drawable {
        private final String kind;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final int intrinsic = dp(24);

        Glyph(String kind, int color) {
            this.kind = kind;
            paint.setColor(color);
            paint.setStrokeWidth(1.8f);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
        }

        @Override public void draw(Canvas canvas) {
            int save = canvas.save();
            canvas.translate(getBounds().left, getBounds().top);
            canvas.scale(getBounds().width() / 24f, getBounds().height() / 24f);
            paint.setStyle(Paint.Style.STROKE);
            if ("more".equals(kind)) {
                paint.setStyle(Paint.Style.FILL);
                for (int y = 5; y <= 19; y += 7) canvas.drawCircle(12, y, 1.7f, paint);
            } else if ("stop".equals(kind)) {
                paint.setStyle(Paint.Style.FILL);
                canvas.drawRoundRect(new RectF(6, 6, 18, 18), 2, 2, paint);
            } else if ("attach".equals(kind)) {
                canvas.drawLine(12, 4, 12, 20, paint);
                canvas.drawLine(4, 12, 20, 12, paint);
            } else if ("microphone".equals(kind)) {
                canvas.drawRoundRect(new RectF(8, 2, 16, 15), 4, 4, paint);
                canvas.drawArc(new RectF(5, 6, 19, 19), 0, 180, false, paint);
                canvas.drawLine(12, 19, 12, 22, paint);
                canvas.drawLine(8, 22, 16, 22, paint);
            } else if ("send".equals(kind)) {
                Path path = new Path();
                path.moveTo(3, 3); path.lineTo(22, 12); path.lineTo(3, 21);
                path.lineTo(6, 13); path.lineTo(16, 12); path.lineTo(6, 11); path.close();
                canvas.drawPath(path, paint);
            } else if ("chats".equals(kind)) {
                canvas.drawRoundRect(new RectF(3, 3, 21, 18), 3, 3, paint);
                Path path = new Path(); path.moveTo(7, 18); path.lineTo(5, 22); path.lineTo(13, 18);
                canvas.drawPath(path, paint);
            } else if ("chamber".equals(kind)) {
                canvas.drawCircle(12, 12, 9, paint);
                canvas.drawOval(new RectF(7, 3, 17, 21), paint);
                canvas.drawLine(3, 12, 21, 12, paint);
            } else if ("environment".equals(kind)) {
                Path path = new Path(); path.moveTo(12, 2); path.lineTo(21, 7); path.lineTo(21, 17);
                path.lineTo(12, 22); path.lineTo(3, 17); path.lineTo(3, 7); path.close();
                canvas.drawPath(path, paint);
                canvas.drawLine(12, 12, 12, 22, paint);
                canvas.drawLine(3, 7, 12, 12, paint);
                canvas.drawLine(21, 7, 12, 12, paint);
            } else if ("activity".equals(kind)) {
                Path path = new Path(); path.moveTo(2, 13); path.lineTo(6, 13); path.lineTo(9, 4);
                path.lineTo(14, 21); path.lineTo(18, 10); path.lineTo(22, 10);
                canvas.drawPath(path, paint);
            } else if ("settings".equals(kind)) {
                canvas.drawCircle(12, 12, 6.5f, paint);
                canvas.drawCircle(12, 12, 2.5f, paint);
                for (int angle = 0; angle < 360; angle += 45) {
                    double radians = Math.toRadians(angle);
                    canvas.drawLine(12 + 7 * (float) Math.cos(radians), 12 + 7 * (float) Math.sin(radians),
                        12 + 10 * (float) Math.cos(radians), 12 + 10 * (float) Math.sin(radians), paint);
                }
            }
            canvas.restoreToCount(save);
        }

        @Override public int getIntrinsicWidth() { return intrinsic; }
        @Override public int getIntrinsicHeight() { return intrinsic; }
        @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); invalidateSelf(); }
        @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); invalidateSelf(); }
        @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    }

    private LinearLayout vertical() {
        LinearLayout result = new LinearLayout(getContext());
        result.setOrientation(LinearLayout.VERTICAL);
        return result;
    }

    private LinearLayout horizontal() {
        LinearLayout result = new LinearLayout(getContext());
        result.setOrientation(LinearLayout.HORIZONTAL);
        result.setGravity(Gravity.CENTER_VERTICAL);
        return result;
    }

    private GradientDrawable round(int color, float radius) {
        GradientDrawable result = new GradientDrawable();
        result.setColor(color);
        result.setCornerRadius(dp(radius));
        return result;
    }

    private GradientDrawable outline(int fill, float radius, int stroke) {
        GradientDrawable result = round(fill, radius);
        result.setStroke(dp(1), stroke);
        return result;
    }

    private int agentColor(String agentId) {
        JSONArray roster = payload.optJSONArray("roster");
        if (roster != null) for (int i = 0; i < roster.length(); i++) {
            JSONObject agent = roster.optJSONObject(i);
            if (agent != null && agentId.equals(agent.optString("id"))) return color(agent.opt("color"), SECONDARY);
        }
        return agentId.equals(payload.optString("agent")) ? color(payload.opt("color"), SELECTED) : SECONDARY;
    }

    private static int withAlpha(int value, int alpha) {
        return (value & 0x00ffffff) | (alpha << 24);
    }

    private static int tint(int background, int accent, float fraction) {
        return Color.rgb(Math.round(Color.red(background) * (1 - fraction) + Color.red(accent) * fraction),
            Math.round(Color.green(background) * (1 - fraction) + Color.green(accent) * fraction),
            Math.round(Color.blue(background) * (1 - fraction) + Color.blue(accent) * fraction));
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private JSONObject scope() {
        JSONObject result = data("agent", payload.optString("agent"));
        try {
            result.put("sessionId", payload.optString("sessionId"));
            result.put("sessionKey", payload.optString("sessionKey"));
            result.put("runId", payload.optString("controlRunId"));
        } catch (JSONException ignored) { }
        return result;
    }

    private boolean sameScope(JSONObject origin) {
        return origin.optString("agent").equals(payload.optString("agent"))
            && origin.optString("sessionKey").equals(payload.optString("sessionKey"))
            && origin.optString("sessionId").equals(payload.optString("sessionId"));
    }

    private void withScope(JSONObject origin, Runnable callback) {
        JSONObject previous = actionScope;
        actionScope = origin;
        try { callback.run(); } finally { actionScope = previous; }
    }

    private void applyScale(View target) {
        if (target instanceof TextView) {
            Float base = baseTextSizes.get((TextView) target);
            if (base != null) ((TextView) target).setTextSize(base * appScale);
        }
        if (target instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) target;
            for (int i = 0; i < group.getChildCount(); i++) applyScale(group.getChildAt(i));
        }
    }

    private void setOptional(TextView target, String value) {
        target.setVisibility(value == null || value.isEmpty() ? GONE : VISIBLE);
        setText(target, value == null ? "" : value);
    }

    private void setText(TextView target, String value) {
        if (!target.getText().toString().equals(value)) target.setText(value);
    }

    private static JSONObject data(String key, Object value) {
        JSONObject result = new JSONObject();
        try { result.put(key, value); } catch (JSONException ignored) { }
        return result;
    }

    private static JSONObject mediaData(String id, int index) {
        JSONObject result = data("id", id);
        try { result.put("index", index); } catch (JSONException ignored) { }
        return result;
    }

    private static JSONObject messageData(JSONObject message) {
        JSONObject result = data("id", message.optString("id"));
        if (message.optBoolean("localSubmission")) {
            try { result.put("localSubmission", true); } catch (JSONException ignored) { }
        }
        return result;
    }

    private static String submissionNote(JSONObject message) {
        String label;
        switch (message.optString("submissionState")) {
            case "pending": label = "Submission pending"; break;
            case "accepted": label = "Submission accepted · admission only"; break;
            case "rejected": label = "Submission rejected"; break;
            case "uncertain": label = "Submission outcome uncertain"; break;
            default: label = "Submission state unavailable";
        }
        String note = message.optString("submissionNote");
        return label + (note.isEmpty() ? "" : " · " + note);
    }

    private static void append(StringBuilder builder, String line) {
        if (builder.length() > 0) builder.append('\n');
        builder.append(line);
    }

    private static String rateLabel(double rate) {
        return (Math.rint(rate) == rate ? Integer.toString((int) rate) : Double.toString(rate)) + "×";
    }

    private static int color(Object value, int fallback) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value instanceof String) try { return Color.parseColor((String) value); } catch (IllegalArgumentException ignored) { }
        return fallback;
    }

    private static String time(Object value) {
        long millis = orderTime(value);
        return millis > 0 ? DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date(millis)) : "Time unavailable";
    }

    private static long orderTime(Object value) {
        if (value instanceof Number) {
            double numeric = ((Number) value).doubleValue();
            if (Double.isNaN(numeric) || Double.isInfinite(numeric) || numeric <= 0 || numeric > 8640000000000000L) return 0;
            long millis = ((Number) value).longValue();
            return millis < 100000000000L ? millis * 1000 : millis;
        }
        if (value instanceof String) {
            try { return orderTime(Long.parseLong((String) value)); } catch (NumberFormatException ignored) { }
            String[] formats = {"yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX"};
            for (String format : formats) {
                SimpleDateFormat parser = new SimpleDateFormat(format, Locale.ROOT);
                parser.setLenient(false);
                ParsePosition position = new ParsePosition(0);
                Date date = parser.parse((String) value, position);
                if (date != null && position.getIndex() == ((String) value).length() && date.getTime() > 0) return date.getTime();
            }
        }
        return 0;
    }

    private static long stableId(String key) {
        long hash = 0xcbf29ce484222325L;
        for (int i = 0; i < key.length(); i++) hash = (hash ^ key.charAt(i)) * 0x100000001b3L;
        return hash;
    }

    private static String delivery(Object value) {
        if (value instanceof String) return (String) value;
        if (!(value instanceof JSONObject)) return "Delivery legs unconfirmed · handset use unverified";
        JSONObject item = (JSONObject) value;
        String text = leg(item.opt("text"));
        String voice = leg(item.opt("voice"));
        return "Text: " + text + " · Voice: " + voice + " · Handset use: "
            + item.optString("deviceAcceptance", "unverified");
    }

    private static String leg(Object value) {
        if (value instanceof String) return (String) value;
        if (value instanceof JSONObject) return ((JSONObject) value).optString("status", "unconfirmed");
        return "unconfirmed";
    }

    /** Details are already safely projected by Watch; never stringify arbitrary tool payloads. */
    private static String detail(Object value) {
        if (value instanceof String) return (String) value;
        if (!(value instanceof JSONObject)) return "";
        JSONObject detail = (JSONObject) value;
        StringBuilder result = new StringBuilder();
        String[] fields = {"tool", "toolName", "operation", "effect", "result", "outcome", "agent", "sessionId", "runId", "callId", "lifecycle", "coverage", "freshness", "gap", "warning"};
        for (String key : fields) {
            Object item = detail.opt(key);
            if (item instanceof String || item instanceof Number || item instanceof Boolean) append(result, key + ": " + item);
        }
        return result.toString();
    }
}
