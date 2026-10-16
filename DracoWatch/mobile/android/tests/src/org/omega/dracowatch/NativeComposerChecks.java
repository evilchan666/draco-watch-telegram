package org.omega.dracowatch;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.EditText;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Actual native review dialogs against an unpaired target and synthetic action
 * listener. No request, file preview/playback, microphone, agent input or retry
 * reaches transport. These checks establish native custody behavior, not phone
 * usability, network delivery or physical-device acceptance. */
public final class NativeComposerChecks extends Instrumentation {
    private Activity activity;
    private TelegramSurface surface;
    private int checks;
    private final List<JSONObject> actions = new ArrayList<>();

    private interface UiCall<T> { T run() throws Exception; }
    private <T> T ui(UiCall<T> task) throws Exception {
        if (Looper.myLooper() == Looper.getMainLooper()) return task.run();
        Object[] result = new Object[1]; Throwable[] failure = new Throwable[1];
        runOnMainSync(() -> { try { result[0] = task.run(); } catch (Throwable error) { failure[0] = error; } });
        if (failure[0] != null) throw new AssertionError("Native UI operation failed", failure[0]);
        @SuppressWarnings("unchecked") T value = (T) result[0]; return value;
    }
    private void check(boolean condition, String label) {
        if (!condition) throw new AssertionError(label);
        checks++; android.util.Log.i("DracoNativeComposerCheck", "PASS " + label);
    }
    private static JSONObject json(Object... pairs) throws Exception {
        JSONObject value = new JSONObject();
        for (int i = 0; i < pairs.length; i += 2) value.put((String) pairs[i], pairs[i + 1]);
        return value;
    }
    private JSONObject model(String agent) throws Exception {
        return json("visible", true, "chat", true, "view", "environment", "world", true, "worldDock", true,
            "worldExpanded", false, "agent", agent, "sessionId", "physical-" + agent, "sessionKey", "fixture:" + agent,
            "name", agent.toUpperCase(java.util.Locale.ROOT), "status", "Synthetic current session", "live", true,
            "draft", "Exact unsent draft retained", "replyId", "m1", "replyLabel", "Reply to original public message m1", "appScale", 1,
            "can", json("send", true, "attachments", true, "voice", true), "recording", false,
            "messages", new JSONArray().put(json("id", "m1", "role", "assistant", "text", "Original public message", "timestamp", 1700000000000L)),
            "attachments", new JSONArray().put(json("id", "draft-file", "name", "Draft voice.m4a", "state", "ready")),
            "outbox", new JSONArray(), "pins", new JSONArray(), "work", new JSONArray(), "voiceStatus", "Ready · no audio played");
    }
    private JSONObject request(boolean retry, String state) throws Exception {
        return json("id", "original-uncertain", "path", "/v1/message", "localSubmission", true,
            "sessionId", "physical-atlas", "priorSession", false, "state", state, "retry", retry,
            "note", "Acceptance is unconfirmed; reading and completion are not established.");
    }
    private JSONObject withRequest(boolean retry, String state) throws Exception {
        return model("atlas").put("outbox", new JSONArray().put(request(retry, state)));
    }
    private void render(JSONObject model) throws Exception {
        ui(() -> { surface.render(model); return null; }); waitForIdleSync(); SystemClock.sleep(100);
    }
    private View tag(String name) throws Exception {
        View result = ui(() -> surface.findViewWithTag(name));
        if (result == null) throw new AssertionError("Missing native control " + name);
        return result;
    }
    private void click(String name) throws Exception {
        View control = tag(name);
        ui(() -> { check(control.isShown() && control.isEnabled(), "reachable native control " + name); control.performClick(); return null; });
        waitForIdleSync(); SystemClock.sleep(100);
    }
    private List<AccessibilityNodeInfo> roots() {
        List<AccessibilityNodeInfo> result = new ArrayList<>();
        for (AccessibilityWindowInfo window : getUiAutomation().getWindows()) {
            AccessibilityNodeInfo root = window.getRoot(); if (root != null) result.add(root);
        }
        AccessibilityNodeInfo active = getUiAutomation().getRootInActiveWindow();
        if (active != null) result.add(active);
        return result;
    }
    private AccessibilityNodeInfo find(AccessibilityNodeInfo node, String text, boolean exact) {
        if (node == null) return null;
        CharSequence supplied = node.getText();
        if (supplied != null && node.isVisibleToUser()
            && (exact ? text.equalsIgnoreCase(supplied.toString()) : supplied.toString().contains(text))) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo found = find(node.getChild(i), text, exact); if (found != null) return found;
        }
        return null;
    }
    private AccessibilityNodeInfo find(String text, boolean exact) {
        for (AccessibilityNodeInfo root : roots()) { AccessibilityNodeInfo found = find(root, text, exact); if (found != null) return found; }
        return null;
    }
    private boolean scroll(AccessibilityNodeInfo node) {
        if (node == null) return false;
        if (node.isVisibleToUser() && node.isScrollable() && node.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)) return true;
        for (int i = 0; i < node.getChildCount(); i++) if (scroll(node.getChild(i))) return true;
        return false;
    }
    private void choose(String text, boolean exact) throws Exception {
        AccessibilityNodeInfo node = null;
        for (int i = 0; i < 35; i++) {
            node = find(text, exact); if (node != null) break;
            for (AccessibilityNodeInfo root : roots()) if (scroll(root)) break;
            SystemClock.sleep(80);
        }
        if (node == null) throw new AssertionError("Missing native dialog choice " + text);
        for (int i = 0; i < 6 && !node.isClickable() && node.getParent() != null; i++) node = node.getParent();
        check(node.performAction(AccessibilityNodeInfo.ACTION_CLICK), "actual native dialog choice " + text);
        waitForIdleSync(); SystemClock.sleep(100);
    }
    private void choose(String text) throws Exception { choose(text, true); }
    private void fileDialog() throws Exception { click("telegram-pending"); choose("File · Draft voice.m4a", false); }
    private void outboxDialog() throws Exception { click("telegram-pending"); choose("Original ID: original-uncertain", false); }
    private int count() throws Exception { return ui(() -> actions.size()); }
    private JSONObject event(int from, String action) throws Exception {
        return ui(() -> { for (int i = actions.size() - 1; i >= from; i--) if (action.equals(actions.get(i).optString("action"))) return actions.get(i); return null; });
    }
    private void none(int from, String action, String label) throws Exception { check(event(from, action) == null, label); }
    private void scoped(int from, String action, String id, String label) throws Exception {
        JSONObject emitted = event(from, action); JSONObject data = emitted == null ? null : emitted.optJSONObject("data");
        check(data != null && "atlas".equals(data.optString("agent")) && "physical-atlas".equals(data.optString("sessionId"))
            && "fixture:atlas".equals(data.optString("sessionKey")) && (id == null || id.equals(data.optString("id"))), label);
    }
    private void retained(View editor, int from, String label) throws Exception {
        check(editor == tag("telegram-draft") && "Exact unsent draft retained".equals(ui(() -> ((EditText) editor).getText().toString())), label);
        none(from, "composer", "routine native review never requests the legacy composer");
    }

    private void attachments() throws Exception {
        render(model("atlas")); View editor = tag("telegram-draft"); int start = count();
        fileDialog(); check(find("Ready to send with this draft", false) != null, "attachment dialog labels ready draft file");
        choose("Preview"); scoped(start, "attachmentPreview", "draft-file", "preview keeps exact attachment and physical-session custody");
        retained(editor, start, "preview review preserves real composer widget and exact text");

        start = count(); fileDialog(); choose("Remove attachment");
        scoped(start, "attachmentRemove", "draft-file", "remove carries only the original staged file and scope");
        retained(editor, start, "removal request cannot clear the text draft");

        render(withRequest(false, "pending")); start = count(); fileDialog();
        check(find("Removal is locked", false) != null && find("Remove attachment", true) == null, "unresolved request removes the destructive file action and explains retention");
        choose("Close"); none(start, "attachmentRemove", "locked file review emits no removal");

        render(model("atlas")); start = count(); fileDialog(); render(withRequest(false, "pending")); choose("Remove attachment");
        none(start, "attachmentRemove", "new unresolved owner revokes an already-open Remove callback");

        render(model("atlas")); start = count(); fileDialog(); render(model("forge")); choose("Preview");
        none(start, "attachmentPreview", "stale other-agent Preview callback cannot play current or original files");

        render(model("atlas")); start = count(); fileDialog();
        render(model("atlas").put("sessionId", "replacement-atlas").put("sessionKey", "replacement:atlas")); choose("Remove attachment");
        none(start, "attachmentRemove", "physical-session replacement revokes a previously opened Remove callback");

        render(model("atlas")); start = count(); fileDialog(); render(model("atlas").put("attachments", new JSONArray())); choose("Preview");
        none(start, "attachmentPreview", "file removal or acceptance revokes stale Preview eligibility");
    }

    private void replies() throws Exception {
        render(model("atlas")); View editor = tag("telegram-draft"); int start = count();
        click("telegram-enter-top"); check(find("Reply to original public message m1", false) != null, "reply review displays supplied original reference");
        choose("Clear reply"); scoped(start, "replyClear", "m1", "native clear-reply action remains session-bound");
        retained(editor, start, "reply clear preserves real text composer and draft");

        render(model("atlas")); start = count(); click("telegram-enter-top");
        render(model("atlas").put("replyLabel", "A newly selected reply")); choose("Clear reply");
        none(start, "replyClear", "changed reply reference revokes old clear control");
        render(model("atlas")); start = count(); click("telegram-enter-top");
        render(model("atlas").put("replyId", "different-message-with-same-label")); choose("Clear reply");
        none(start, "replyClear", "identically labelled new reply cannot alias old clear identity");

        render(model("atlas")); start = count(); click("telegram-enter-top"); render(model("forge")); choose("Clear reply");
        none(start, "replyClear", "stale reply dialog cannot clear another agent's reply");
    }

    private void outbox() throws Exception {
        render(withRequest(true, "uncertain")); View editor = tag("telegram-draft"); int start = count(); outboxDialog();
        check(find("Original ID: original-uncertain", false) != null && find("Status: uncertain", false) != null
            && find("Original session: physical-atlas", false) != null, "outbox review exposes original request identity, status and session");
        choose("Check original ID"); scoped(start, "retry", "original-uncertain", "eligible uncertain check reuses exact original ID without inventing a submission");
        none(start, "send", "outbox check never calls Send"); retained(editor, start, "original-ID review retains draft and native composer");

        render(withRequest(false, "uncertain")); start = count(); outboxDialog();
        check(find("Check original ID", true) == null, "retry false never offers steering or other forbidden replay"); choose("Close");
        none(start, "retry", "non-retryable uncertainty remains unsubmitted");

        render(withRequest(true, "pending")); start = count(); outboxDialog();
        check(find("Check original ID", true) == null, "pending request cannot retry even with malformed retry true"); choose("Close");
        none(start, "retry", "pending outbox review does not duplicate delivery");

        render(withRequest(true, "uncertain")); start = count(); outboxDialog(); render(withRequest(false, "uncertain")); choose("Check original ID");
        none(start, "retry", "retry revocation invalidates an already-open original-ID button");

        render(withRequest(true, "uncertain")); start = count(); outboxDialog(); render(model("forge")); choose("Check original ID");
        none(start, "retry", "old outbox dialog cannot retry after another agent becomes selected");

        render(withRequest(true, "uncertain")); start = count(); outboxDialog(); render(model("atlas")); choose("Check original ID");
        none(start, "retry", "resolved or retired original request cannot be retried through its stale dialog");
    }

    private void recordingAndFallback() throws Exception {
        render(model("atlas").put("recording", true)); int start = count(); click("telegram-pending"); choose("Finish current voice recording");
        scoped(start, "recordStop", null, "native review can finish only the current scoped recording");
        none(start, "composer", "finish recording does not replace the native renderer");

        render(model("atlas").put("recording", true)); start = count(); click("telegram-pending"); render(model("atlas")); choose("Finish current voice recording");
        none(start, "recordStop", "already-finished recording revokes old Finish action");

        render(model("atlas")); start = count(); click("telegram-pending"); choose("Advanced full composer · legacy fallback");
        scoped(start, "composer", null, "legacy composer is available only as an explicitly labelled fallback choice");
    }

    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            check(DracoClient.loadProfile(getTargetContext()) == null, "mandatory unpaired target excludes production access");
            AccessibilityServiceInfo service = getUiAutomation().getServiceInfo();
            service.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            getUiAutomation().setServiceInfo(service);
            activity = startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(), "org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            waitForIdleSync();
            ui(() -> {
                surface = new TelegramSurface(activity, (action, data) -> {
                    try { actions.add(json("action", action, "data", new JSONObject(data.toString()))); }
                    catch (Exception error) { throw new AssertionError(error); }
                });
                activity.setContentView(surface); return null;
            });
            attachments(); replies(); outbox(); recordingAndFallback();
            result.putString("stream", "Native composer checks passed: " + checks + ". Actual native dialogs; unpaired synthetic listener. No transport, playback, recording or live input.\n");
            finish(0, result);
        } catch (Throwable error) {
            result.putString("stream", "Native composer checks failed after " + checks + ": " + error + "\n");
            android.util.Log.e("DracoNativeComposerCheck", "FAIL", error); finish(1, result);
        } finally { if (activity != null) runOnMainSync(() -> activity.finish()); }
    }
}
