package org.omega.dracowatch;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityNodeInfo;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Integrated WebView -> real MonitorActivity bridge -> actual TelegramSurface,
 * then native actions back through MonitorActivity -> the real app.js handler.
 * An unpaired APK is mandatory. Only refresh/request/media test spies are used;
 * renderTelegram and native action delivery are the application's real code.
 * Synthetic public records do not establish real agent or handset acceptance.
 */
public final class TelegramBridgeChecks extends Instrumentation {
    private Activity activity;
    private WebView web;
    private TelegramSurface surface;
    private Bundle arguments;
    private int checks;
    private String originalCache;
    private static final String CACHE = "draco-watch-client-v2";
    private static final String SESSION = "bridge-physical-atlas";
    private static final String MESSAGE = "bridge-readable-final";
    private static final String PUBLIC_TEXT = "BRIDGE EXACT PUBLIC FINAL\nA selectable readable report follows the existing public projection, not an invented Telegram service.\nEND_OF_EXACT_PUBLIC_FINAL";
    private static final String DRAFT = "BRIDGE exact native draft\nKeep punctuation, spaces and every character. Æra / FORGE.";

    @Override public void onCreate(Bundle args) { super.onCreate(args); arguments = args == null ? new Bundle() : args; start(); }
    private interface UiCall<T> { T run() throws Exception; }
    private <T> T ui(UiCall<T> task) throws Exception {
        if (Looper.myLooper() == Looper.getMainLooper()) return task.run();
        Object[] result = new Object[1]; Throwable[] failure = new Throwable[1];
        runOnMainSync(() -> { try { result[0] = task.run(); } catch (Throwable e) { failure[0] = e; } });
        if (failure[0] != null) throw new AssertionError("UI task failed", failure[0]);
        @SuppressWarnings("unchecked") T value = (T) result[0]; return value;
    }
    private Field field(String name) throws Exception { Field f = activity.getClass().getDeclaredField(name); f.setAccessible(true); return f; }
    private String js(String source) throws Exception {
        String[] result = new String[1]; CountDownLatch done = new CountDownLatch(1);
        ui(() -> { web.evaluateJavascript(source, value -> { result[0] = value; done.countDown(); }); return null; });
        if (!done.await(5, TimeUnit.SECONDS)) throw new AssertionError("WebView evaluation timed out");
        return result[0];
    }
    private void waitJs(String condition) throws Exception {
        for (int i = 0; i < 100; i++) { if ("true".equals(js(condition))) return; SystemClock.sleep(100); }
        throw new AssertionError("JavaScript state did not settle: " + condition);
    }
    private void waitShowing(boolean visible) throws Exception {
        for (int i = 0; i < 100; i++) { if (ui(() -> surface.showing()) == visible) { waitForIdleSync(); return; } SystemClock.sleep(100); }
        throw new AssertionError("Actual native surface visibility did not become " + visible);
    }
    private void check(boolean value, String label) {
        if (!value) throw new AssertionError(label); checks++; android.util.Log.i("DracoTelegramBridge", "PASS " + label);
    }
    private void jsCheck(String expression, String label) throws Exception { check("true".equals(js(expression)), label); }
    private View tag(String value) throws Exception { return ui(() -> surface.findViewWithTag(value)); }
    private View requireTag(String value) throws Exception { View v = tag(value); if (v == null) throw new AssertionError("Missing actual native view " + value); return v; }
    private void click(View v) throws Exception { ui(() -> { check(v.isEnabled(), "native control enabled: " + v.getTag()); v.performClick(); return null; }); waitForIdleSync(); }
    private List<View> descendants(View root) {
        List<View> result = new ArrayList<>(); result.add(root);
        if (root instanceof ViewGroup) { ViewGroup g = (ViewGroup) root; for (int i = 0; i < g.getChildCount(); i++) result.addAll(descendants(g.getChildAt(i))); }
        return result;
    }
    private String rowsText() throws Exception {
        return ui(() -> {
            ListView list = (ListView) requireTag("telegram-timeline"); StringBuilder text = new StringBuilder();
            for (int i = 0; i < list.getAdapter().getCount(); i++) for (View v : descendants(list.getAdapter().getView(i, null, list))) if (v instanceof TextView) text.append(((TextView) v).getText()).append('\n');
            return text.toString();
        });
    }
    private void waitRows(String expected) throws Exception {
        for (int i = 0; i < 100; i++) { if (rowsText().contains(expected)) return; SystemClock.sleep(100); }
        throw new AssertionError("Actual native rows did not receive expected text: " + expected);
    }
    private AccessibilityNodeInfo exactNode(String label) {
        AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow(); if (root == null) return null;
        for (AccessibilityNodeInfo n : root.findAccessibilityNodeInfosByText(label)) if (n.getText() != null && label.equalsIgnoreCase(n.getText().toString())) return n;
        return null;
    }
    private void dialogChoice(String label) throws Exception {
        AccessibilityNodeInfo n = null;
        for (int i = 0; i < 40 && n == null; i++) { n = exactNode(label); if (n == null) SystemClock.sleep(80); }
        if (n == null) throw new AssertionError("Native dialog choice missing: " + label);
        for (int i = 0; i < 5 && !n.isClickable() && n.getParent() != null; i++) n = n.getParent();
        check(n.performAction(AccessibilityNodeInfo.ACTION_CLICK), "native dialog choice: " + label); waitForIdleSync();
    }
    private void installTestBoundary() throws Exception {
        // Preserve the genuine Java bridge render call. No network/input/media
        // method crosses the test boundary; every attempted operation is logged.
        js("(()=>{const actual=window.DracoNative;window.bridgeChecks={renderCount:0,calls:[],actions:[],actualRender:typeof actual.renderTelegram==='function'};"
            + "window.DracoNative={renderTelegram(value){bridgeChecks.renderCount++;actual.renderTelegram(value);},notifyTelegram(){},"
            + "refresh(agent){bridgeChecks.calls.push({method:'REFRESH',agent});},"
            + "request(id,method,path,body){bridgeChecks.calls.push({method,path,body});setTimeout(()=>{const agent=new URL('https://fixture.invalid'+path).searchParams.get('agent');onDracoResponse({id,ok:true,status:200,data:{agent,sessionId:'bridge-physical-'+agent,send:false,queue:false,steer:false,strictSteer:false,abort:false,reply:false,speech:false,attachments:false,commands:[]}});},0);},"
            + "stopMedia(){bridgeChecks.calls.push({method:'STOP-MEDIA'});},playMedia(){bridgeChecks.calls.push({method:'PLAY-MEDIA'});},setPlaybackRate(){},hideKeyboard(){actual.hideKeyboard();}};"
            + "const handler=window.onDracoTelegramAction;window.onDracoTelegramAction=event=>{bridgeChecks.actions.push(JSON.parse(JSON.stringify(event)));return handler(event);};"
            + "window.bridgeFixture=()=>{const ids=['main','forge','atlas','aera-new','vvv','daedalus'],now=Date.now(),message={id:" + JSONObject.quote(MESSAGE) + ",agent:'atlas',sessionId:'" + SESSION + "',role:'assistant',text:" + JSONObject.quote(PUBLIC_TEXT) + ",timestamp:now-1000,kind:'Public report',publicAttested:true,source:'authenticated-native-history',media:[]};"
            + "return {version:2,connected:true,lastSuccess:now,capturedAt:now,selectedAgent:'atlas',agents:ids.map(id=>({id,status:id==='atlas'?'active':'idle',sessionId:'bridge-physical-'+id,sessionKey:'bridge:'+id,capabilities:{send:false,queue:false,steer:false,abort:false},controlTargets:[]})),conversation:[message,{id:'bridge-private-denied',agent:'atlas',sessionId:'" + SESSION + "',role:'assistant',text:'PRIVATE MUST NEVER REACH NATIVE',timestamp:now,publicAttested:false,source:'private-peer'}],historyState:{status:'complete'},historyHasMore:false,fleetCoverage:ids.map(agent=>({agent,available:true,status:'recorded-window'})),fleetActivity:[message],workActivity:[]};};"
            + "onDracoSnapshot(bridgeFixture());DracoWatch.select('atlas');return true;})()");
        waitShowing(true); waitRows(PUBLIC_TEXT);
    }
    private void assertBoundary(String label) throws Exception {
        jsCheck("bridgeChecks.actualRender&&bridgeChecks.renderCount>0", label + " uses real Java renderTelegram, not a substitute native renderer");
        jsCheck("bridgeChecks.calls.every(c=>c.method==='REFRESH'||c.method==='STOP-MEDIA'||c.method==='GET'&&c.path.startsWith('/v1/capabilities?'))", label + " performed no POST, audio playback, synthesis or agent input");
        check(field("profile").get(activity) == null, label + " remains unpaired with no production credentials");
    }
    private void screenshot(String name) throws Exception {
        if (!arguments.getBoolean("screenshots", false)) return;
        waitForIdleSync(); SystemClock.sleep(150); Bitmap shot = getUiAutomation().takeScreenshot();
        if (shot == null) throw new AssertionError("Screenshot unavailable");
        File dir = new File(getTargetContext().getExternalFilesDir(null), "telegram-bridge-checks"); if (!dir.exists() && !dir.mkdirs()) throw new AssertionError("Screenshot directory unavailable");
        File file = new File(dir, name + "-font" + Math.round(activity.getResources().getConfiguration().fontScale * 100) + ".png");
        try (FileOutputStream out = new FileOutputStream(file)) { shot.compress(Bitmap.CompressFormat.PNG, 100, out); } finally { shot.recycle(); }
    }
    private void assertLayout() throws Exception {
        Rect bounds = ui(() -> { Rect r = new Rect(); surface.getGlobalVisibleRect(r); return r; });
        check(bounds.width() > 0 && bounds.height() > 0, "integrated native surface has an actual viewport");
        for (String key : new String[]{"telegram-navigation", "telegram-composer", "telegram-send", "telegram-draft"}) {
            View v = requireTag(key); Rect r = ui(() -> { Rect measured = new Rect(); v.getGlobalVisibleRect(measured); return measured; });
            check(r.width() > 0 && r.height() > 0 && r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1, "integrated " + key + " fits within actual viewport");
        }
        if (arguments.getBoolean("requireFont150", false)) check(activity.getResources().getConfiguration().fontScale >= 1.49f, "actual native Android font is 150 percent");
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            activity = startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(), "org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); waitForIdleSync();
            check(field("profile").get(activity) == null, "unpaired target cannot contact production");
            web = (WebView) field("web").get(activity); surface = (TelegramSurface) field("telegram").get(activity);
            for (int i = 0; i < 100 && !field("loaded").getBoolean(activity); i++) SystemClock.sleep(100);
            check(field("loaded").getBoolean(activity), "real Activity bundled page has completed loading");
            waitJs("document.readyState==='complete'&&!!window.DracoWatch&&typeof onDracoTelegramAction==='function'");
            originalCache = js("localStorage.getItem('" + CACHE + "')");
            js("localStorage.setItem('" + CACHE + "',JSON.stringify({drafts:{},pins:[],pinHistory:[],outbox:[],preferences:{scale:100,motion:true,rendering:'light',echoToTelegram:false,automaticSpeech:false,playbackRate:1}}));window.bridgeReloadSentinel=true");
            ui(() -> { web.reload(); return null; });
            waitJs("document.readyState==='complete'&&!!window.DracoWatch&&typeof window.bridgeReloadSentinel==='undefined'");
            installTestBoundary();
            check(ui(() -> surface.getParent()) == ui(() -> web.getParent()), "real native overlay and retained WebView share the production Activity surface");
            check(ui(() -> descendants(surface).stream().anyMatch(v -> v.getClass().getName().equals("org.telegram.ui.Components.ChatActivityEnterTopView"))), "integrated surface instantiates genuine Telegram composer-top source");
            check(ui(() -> ((TextView) requireTag("telegram-title")).getText().toString()).equals("ATLAS"), "snapshot routes to exact selected agent in actual native header");
            check(rowsText().contains(PUBLIC_TEXT) && !rowsText().contains("PRIVATE MUST NEVER"), "real JS projection admits public exact-session text and excludes private rows");
            jsCheck("bridgeFixture().agents.length===6", "synthetic snapshot retains all six agents");

            EditText draft = (EditText) requireTag("telegram-draft");
            ui(() -> { draft.setText(DRAFT); return null; });
            waitJs("document.getElementById('draft').value===" + JSONObject.quote(DRAFT));
            jsCheck("JSON.parse(localStorage.getItem('" + CACHE + "')).drafts.atlas===" + JSONObject.quote(DRAFT), "native draft reaches actual JS saved exact text");
            jsCheck("bridgeChecks.actions.some(e=>e.action==='draft'&&e.data.agent==='atlas'&&e.data.sessionId==='" + SESSION + "'&&e.data.text===" + JSONObject.quote(DRAFT) + ")", "actual MonitorActivity delivers native draft back with exact agent/physical-session scope");
            click(requireTag("telegram-send")); click(requireTag("telegram-stop-run"));
            jsCheck("!bridgeChecks.actions.some(e=>e.action==='send'||e.action==='stop')", "all-false capability controls refuse without native send/stop dispatch");

            js("onDracoTelegramAction({action:'pin',data:{agent:'atlas',sessionId:'WRONG-PHYSICAL-SESSION',id:'" + MESSAGE + "'}})");
            jsCheck("JSON.parse(localStorage.getItem('" + CACHE + "')).pins.length===0", "bridge rejects stale physical-session pin before persistence");
            js("onDracoTelegramAction({action:'pin',data:{agent:'atlas',sessionId:'" + SESSION + "',id:'" + MESSAGE + "'}})");
            for (int i = 0; i < 100 && ui(() -> requireTag("telegram-pinned-banner").getVisibility()) != View.VISIBLE; i++) SystemClock.sleep(100);
            check(ui(() -> requireTag("telegram-pinned-banner").getVisibility()) == View.VISIBLE, "actual persisted pin is displayed by real native banner");
            jsCheck("JSON.parse(localStorage.getItem('" + CACHE + "')).pins.some(p=>p.agent==='atlas'&&p.sessionId==='" + SESSION + "'&&p.messageId==='" + MESSAGE + "')", "pin stores exact admitted message/session instead of a floating title");
            screenshot("integrated-pinned-chat"); assertBoundary("first-page bridge");

            js("window.bridgeReloadSentinel=true"); ui(() -> { web.reload(); return null; });
            waitJs("document.readyState==='complete'&&!!window.DracoWatch&&typeof window.bridgeReloadSentinel==='undefined'");
            installTestBoundary();
            check(ui(() -> ((EditText) requireTag("telegram-draft")).getText().toString()).equals(DRAFT), "actual page reload rehydrates native draft exactly from durable JS storage");
            check(ui(() -> requireTag("telegram-pinned-banner").getVisibility()) == View.VISIBLE, "actual page reload restores exact-session native pin banner");

            click(requireTag("telegram-nav-environment")); waitShowing(false);
            waitJs("!document.getElementById('view-environment').hidden&&document.getElementById('conversation-screen').hidden");
            jsCheck("(()=>{const r=document.getElementById('environment-canvas').getBoundingClientRect();return r.width>100&&r.height>50;})()", "native navigation reveals the retained real Environment renderer");
            jsCheck("bridgeChecks.actions.some(e=>e.action==='view'&&e.data.view==='environment'&&e.data.agent==='atlas'&&e.data.sessionId==='" + SESSION + "')", "Environment navigation traverses real native-to-JS action delivery");
            screenshot("integrated-environment");
            js("DracoWatch.select('atlas')"); waitShowing(true); waitRows(PUBLIC_TEXT);
            check(ui(() -> ((EditText) requireTag("telegram-draft")).getText().toString()).equals(DRAFT), "return from Environment preserves native conversation draft");

            click(requireTag("telegram-options")); dialogChoice("Files, drafts and outbox");
            waitJs("document.getElementById('conversation-actions-dialog').open"); waitShowing(false);
            jsCheck("bridgeChecks.actions.some(e=>e.action==='tools'&&e.data.agent==='atlas'&&e.data.sessionId==='" + SESSION + "')", "native advanced-tools action reaches existing exact-scope JS dialog");
            screenshot("integrated-advanced-dialog");
            js("document.getElementById('conversation-actions-close').click()"); waitShowing(true);
            check(ui(() -> ((TextView) requireTag("telegram-title")).getText().toString()).equals("ATLAS"), "closing legacy advanced dialog restores real native conversation");

            js("(()=>{const e=document.getElementById('display-scale');e.value='150';e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
            SystemClock.sleep(180); assertLayout(); screenshot("integrated-chat-app150");
            assertBoundary("reloaded-page bridge");
            result.putString("stream", "Telegram bridge checks passed: " + checks + ". Actual Activity/WebView/native rendering and native action return; synthetic unpaired state, transport/media spies, no production input/audio. Physical acceptance remains unverified.\n");
            finish(0, result);
        } catch (Throwable error) {
            result.putString("stream", "Telegram bridge checks failed after " + checks + ": " + error + "\n"); android.util.Log.e("DracoTelegramBridge", "FAIL", error);
            try { screenshot("failed-after-" + checks); } catch (Exception ignored) { }
            finish(1, result);
        } finally {
            if (web != null && originalCache != null) try { js(originalCache.equals("null") ? "localStorage.removeItem('" + CACHE + "')" : "localStorage.setItem('" + CACHE + "'," + originalCache + ")"); } catch (Exception ignored) { }
            if (activity != null) runOnMainSync(() -> activity.finish());
        }
    }
}
