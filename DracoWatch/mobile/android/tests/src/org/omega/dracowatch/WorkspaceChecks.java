package org.omega.dracowatch;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.Looper;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import android.widget.EditText;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Retained-world conversation acceptance fixture. Requires a deliberately
 * UNPAIRED APK, real Android font150 and app150. Actual Activity, WebView,
 * Telegram native tree, touch, IME and screenshots; all recipient snapshots,
 * admissions, file selection and voice callbacks remain synthetic. No device
 * network/profile, real microphone, gateway input or published update is used.
 *
 * Run on the owner's isolated emulator only:
 * adb -P 5047 -s emulator-5558 shell am instrument -w \
 *   org.omega.dracowatch.checks/org.omega.dracowatch.WorkspaceChecks
 * Artifacts: target external files/workspace-checks/{portrait,landscape}-*.{png,json}.
 */
public final class WorkspaceChecks extends Instrumentation {
    private static final String CACHE = "draco-watch-client-v2";
    private static final String[] AGENTS = {"main", "forge", "atlas", "aera-new", "vvv", "daedalus"};
    private Activity activity;
    private WebView web;
    private TelegramSurface surface;
    private String savedCache;
    private int checks;
    private final JSONArray evidence = new JSONArray();

    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    private interface UiCall<T> { T run() throws Exception; }
    @SuppressWarnings("unchecked") private <T> T ui(UiCall<T> task) throws Exception {
        if (Looper.myLooper() == Looper.getMainLooper()) return task.run();
        Object[] value = new Object[1]; Throwable[] failure = new Throwable[1];
        runOnMainSync(() -> { try { value[0] = task.run(); } catch (Throwable error) { failure[0] = error; } });
        if (failure[0] != null) throw new AssertionError("UI operation failed", failure[0]);
        return (T) value[0];
    }
    private Object activityField(String name) throws Exception {
        Field f = activity.getClass().getDeclaredField(name); f.setAccessible(true); return f.get(activity);
    }
    private void check(boolean passed, String label) {
        if (!passed) throw new AssertionError(label);
        checks++; android.util.Log.i("DracoWorkspaceCheck", "PASS " + label);
    }
    private String js(String source) throws Exception {
        String[] result = {null}; CountDownLatch done = new CountDownLatch(1);
        runOnMainSync(() -> web.evaluateJavascript(source, value -> { result[0] = value; done.countDown(); }));
        if (!done.await(15, TimeUnit.SECONDS)) throw new AssertionError("WebView callback timed out");
        return result[0];
    }
    private void waitJs(String expression) throws Exception {
        for (int attempt = 0; attempt < 100; attempt++) {
            if ("true".equals(js(expression))) return;
            SystemClock.sleep(100);
        }
        throw new AssertionError("Did not settle: " + expression);
    }
    private void scriptCheck(String expression, String label) throws Exception { check("true".equals(js(expression)), label); }
    private View tag(String name) throws Exception {
        View found = ui(() -> surface.findViewWithTag(name));
        if (found == null) throw new AssertionError("Missing native workspace control: " + name);
        return found;
    }
    private void click(String name) throws Exception {
        View view = tag(name);
        ui(() -> { check(view.isShown() && view.isEnabled(), "visible enabled native action " + name); check(view.performClick(), "native action callback " + name); return null; });
        waitForIdleSync(); SystemClock.sleep(100);
    }
    private Rect bounds(View view) throws Exception {
        return ui(() -> { Rect rect = new Rect(); view.getGlobalVisibleRect(rect); return rect; });
    }
    private int dp(float value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
    private JSONObject pose() throws Exception { return new JSONObject(js("workspaceChecks.renderer.diagnostics().player")); }
    private void samePose(JSONObject expected, String label) throws Exception {
        JSONObject actual = pose();
        check(Math.hypot(expected.getDouble("x") - actual.getDouble("x"), expected.getDouble("z") - actual.getDouble("z")) < .001
            && Math.abs(expected.getDouble("yaw") - actual.getDouble("yaw")) < .001
            && Math.abs(expected.optDouble("pitch") - actual.optDouble("pitch")) < .001, label + " retains exact player position and look");
        JSONObject movement = actual.getJSONObject("movement");
        check(Math.abs(movement.optDouble("x")) + Math.abs(movement.optDouble("z")) < .001, label + " has no stuck movement");
    }
    private float[] point(String selector, float x, float y) throws Exception {
        JSONArray value = new JSONArray(js("(()=>{const r=document.querySelector(" + JSONObject.quote(selector) + ").getBoundingClientRect();return [r.x+r.width*" + x + ",r.y+r.height*" + y + ",innerWidth];})()"));
        int[] origin = new int[2]; runOnMainSync(() -> web.getLocationOnScreen(origin));
        float scale = web.getWidth() / (float) value.getDouble(2);
        return new float[]{origin[0] + (float) value.getDouble(0) * scale, origin[1] + (float) value.getDouble(1) * scale, scale};
    }
    private void pointer(long start, int action, float x, float y) {
        MotionEvent event = MotionEvent.obtain(start, SystemClock.uptimeMillis(), action, x, y, 0);
        sendPointerSync(event); event.recycle();
    }
    private void seedNondefaultPose(String label) throws Exception {
        // Returning to the default pose would be a vacuous retention check.
        // Establish a genuinely different position/look with real Android touch.
        JSONObject before = pose(); float[] pad = point("#world-walk", .5f, .5f);
        long start = SystemClock.uptimeMillis(); pointer(start, MotionEvent.ACTION_DOWN, pad[0], pad[1]);
        SystemClock.sleep(60); pointer(start, MotionEvent.ACTION_MOVE, pad[0], pad[1] - 24 * pad[2]);
        SystemClock.sleep(550); pointer(start, MotionEvent.ACTION_UP, pad[0], pad[1] - 24 * pad[2]); SystemClock.sleep(150);
        float[] look = point("#environment-canvas", .6f, .45f); start = SystemClock.uptimeMillis();
        pointer(start, MotionEvent.ACTION_DOWN, look[0], look[1]);
        for (int i = 1; i <= 5; i++) { SystemClock.sleep(35); pointer(start, MotionEvent.ACTION_MOVE, look[0] + i * 11 * look[2], look[1]); }
        pointer(start, MotionEvent.ACTION_UP, look[0] + 55 * look[2], look[1]); SystemClock.sleep(150);
        JSONObject after = pose();
        check(Math.hypot(before.getDouble("x") - after.getDouble("x"), before.getDouble("z") - after.getDouble("z")) > .03
            && Math.abs(before.getDouble("yaw") - after.getDouble("yaw")) > .03, label + " real touch establishes a nondefault position and look before retention checks");
    }
    private void dismissSystemEducation() {
        AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow();
        if (root == null || root.getPackageName() == null) return;
        if (!("android".contentEquals(root.getPackageName()) || "com.android.systemui".contentEquals(root.getPackageName()))) return;
        for (AccessibilityNodeInfo node : root.findAccessibilityNodeInfosByText("Got it"))
            if (node.isVisibleToUser() && node.isClickable()) node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }
    private void settle() throws Exception {
        String previous = ""; int stable = 0;
        for (int i = 0; i < 70; i++) {
            dismissSystemEducation(); waitForIdleSync();
            String current = bounds(web).toShortString() + ":" + bounds(surface).toShortString()
                + (ui(() -> surface.showing()) ? ":" + bounds(tag("world-conversation-panel")).toShortString() : "");
            stable = current.equals(previous) ? stable + 1 : 0;
            if (stable >= 5) return;
            previous = current; SystemClock.sleep(100);
        }
        throw new AssertionError("Native viewport did not settle");
    }
    private File artifact(String name) throws Exception {
        File folder = new File(getTargetContext().getExternalFilesDir(null), "workspace-checks");
        if (!folder.exists() && !folder.mkdirs()) throw new IOException("Cannot create workspace artifact folder");
        return new File(folder, name);
    }
    private void write(String name, JSONObject body) throws Exception {
        try (FileOutputStream out = new FileOutputStream(artifact(name))) { out.write(body.toString(2).getBytes("UTF-8")); }
    }
    private void failureEvidence(Throwable failure) throws Exception {
        // Only the unpaired synthetic fixture is collected. Do not export the
        // pre-test saved cache, device profile, native journal or live history.
        JSONObject value = new JSONObject(js("(()=>{const f=window.workspaceChecks||{},toast=document.getElementById('toast');return {payload:f.last||null,actions:(f.actions||[]).slice(-100),calls:(f.calls||[]).slice(-150),toasts:(f.toasts||[]).slice(-40),errors:(f.errors||[]).slice(-40),toast:toast?{text:toast.textContent,hidden:toast.hidden}:null,view:document.body.dataset.view,chatOpen:document.body.classList.contains('chat-open')};})()"));
        value.put("checks", checks).put("failure", String.valueOf(failure)).put("scope", "Unpaired synthetic workspace fixture only; no pre-test cache or production profile");
        for (String name : new String[]{"telegram-stop-run", "telegram-draft", "telegram-send", "telegram-mic", "telegram-pending"}) {
            View target = ui(() -> surface.findViewWithTag(name));
            if (target != null) value.put(name, ui(() -> new JSONObject().put("shown", target.isShown()).put("enabled", target.isEnabled()).put("alpha", target.getAlpha()).put("description", String.valueOf(target.getContentDescription()))));
        }
        write("failure.json", value);
    }
    private JSONObject rectJson(Rect value) throws Exception {
        return new JSONObject().put("left", value.left).put("top", value.top).put("right", value.right).put("bottom", value.bottom);
    }

    private void installFixture() throws Exception {
        // Capture the real renderer instance on a normal update; the scene and
        // all native callbacks still go through the actual application reducer.
        js("(()=>{const actual=DracoNative;window.workspaceChecks={calls:[],actions:[],toasts:[],errors:[],last:null,fixtureAt:Date.now(),recordingAgent:null};"
            + "window.addEventListener('error',e=>workspaceChecks.errors.push({message:e.message,source:e.filename,line:e.lineno}));window.addEventListener('unhandledrejection',e=>workspaceChecks.errors.push({rejection:String(e.reason)}));"
            + "const update=DracoEnvironment.Environment.prototype.update;DracoEnvironment.Environment.prototype.update=function(...args){workspaceChecks.renderer=this;return update.apply(this,args);};"
            + "window.workspaceFixture=(agent='atlas')=>{const now=Date.now(),ids=['main','forge','atlas','aera-new','vvv','daedalus'];return {connected:true,lastSuccess:now,capturedAt:now,selectedAgent:agent,"
            + "agents:ids.map(id=>({id,status:'active',conversationStatus:'active',runPhase:{phase:'tool-wait',runId:'workspace-run-'+id,observedAt:now,expiresAt:now+10000},sessionId:'workspace-session-'+id,sessionKey:'agent:'+id+':telegram:direct:8745908879',historyAvailable:true,capabilities:{send:true,queue:true,steer:false,strictSteer:false,abort:true,durableStop:true},controlTargets:[{agent:id,sessionId:'workspace-session-'+id,sessionKey:'agent:'+id+':telegram:direct:8745908879',runId:'workspace-run-'+id,scope:'conversation'}]})),"
            + "historyState:{status:'complete'},conversation:[{id:'workspace-report-'+agent,agent,sessionId:'workspace-session-'+agent,role:'assistant',text:'WORKSPACE EXACT PUBLIC '+agent+'\\nReadable conversation inside the retained operating space. No live work or delivery is claimed.',timestamp:workspaceChecks.fixtureAt-1000,source:'authenticated-native-history',publicAttested:true,media:[]}],"
            + "fleetActivity:ids.map(id=>({id:'workspace-public-'+id,agent:id,sessionId:'workspace-session-'+id,role:'assistant',text:'WORKSPACE PUBLIC '+id,timestamp:workspaceChecks.fixtureAt-1000,source:'authenticated-native-history',publicAttested:true,media:[]})),workActivity:[],fleetCoverage:ids.map(agent=>({agent,available:true}))};};"
            + "const record=(method,agent)=>workspaceChecks.calls.push({method,agent});window.DracoNative={"
            + "renderTelegram(s){workspaceChecks.last=JSON.parse(s);actual.renderTelegram(s);},notifyTelegram(text){workspaceChecks.toasts.push(String(text));},"
            + "refresh(agent){record('REFRESH',agent);setTimeout(()=>onDracoSnapshot(workspaceFixture(agent)),0);},"
            + "request(id,method,path,body){const parsed=body?JSON.parse(body):null;workspaceChecks.calls.push({method,path,body:parsed});const agent=new URL('https://fixture.invalid'+path).searchParams.get('agent')||parsed?.agent||'atlas';"
            + "let data=path.startsWith('/v1/capabilities?')?{agent,sessionId:'workspace-session-'+agent,send:true,queue:true,steer:false,strictSteer:false,abort:true,durableStop:true,attachments:true,voice:true,reply:true,speech:false,commands:[]}:path==='/v1/message'?{status:'accepted',agent,sessionId:parsed.sessionId,idempotencyKey:parsed.idempotencyKey}:path==='/v1/abort'?{status:'accepted',agent,sessionId:parsed.sessionId,sessionKey:parsed.sessionKey,runId:parsed.runId,idempotencyKey:parsed.idempotencyKey}:{};"
            + "setTimeout(()=>onDracoResponse({id,ok:true,status:200,data}),60);},"
            + "chooseAttachment(agent){record('CHOOSE_FILE',agent);setTimeout(()=>onDracoAttachment({state:'ready',agent,id:'workspace-file-'+agent,name:'Workspace synthetic file.txt',mime:'text/plain',sizeBytes:32}),0);},"
            + "startRecording(agent){record('START_RECORDING',agent);workspaceChecks.recordingAgent=agent;setTimeout(()=>onDracoAttachment({state:'recording',agent}),0);},"
            + "stopRecording(){const agent=workspaceChecks.recordingAgent;record('STOP_RECORDING',agent);setTimeout(()=>onDracoAttachment({state:'ready',agent,id:'workspace-voice-'+agent,name:'Workspace synthetic voice.ogg',mime:'audio/ogg',sizeBytes:64,durationMs:1500}),0);},"
            + "cancelAttachment(id){record('CANCEL_FILE',id);setTimeout(()=>onDracoAttachment({id,state:'cancelled'}),0);},releaseAttachment(id){record('RELEASE_FILE',id);},"
            + "stopMedia(){},hideKeyboard(){actual.hideKeyboard();},setPlaybackRate(){},nativeDiagnostics(){return actual.nativeDiagnostics();},recordDiagnostic(){} };"
            + "const handler=onDracoTelegramAction;window.onDracoTelegramAction=e=>{workspaceChecks.actions.push(JSON.parse(JSON.stringify(e)));return handler(e);};"
            + "window.confirm=text=>{workspaceChecks.calls.push({method:'CONFIRM',text});return true;};"
            + "onDracoSnapshot(workspaceFixture());workspaceChecks.timer=setInterval(()=>onDracoSnapshot(workspaceFixture(workspaceChecks.last?.agent||'atlas')),1000);return true;})()");
        waitJs("!!workspaceChecks.renderer&&!!workspaceChecks.last");
    }

    private void open(String agent) throws Exception {
        js("DracoWatch.select(" + JSONObject.quote(agent) + ");true");
        waitJs("workspaceChecks.last?.worldDock===true&&workspaceChecks.last.chat===true&&workspaceChecks.last.world===true&&workspaceChecks.last.view==='environment'&&workspaceChecks.last.agent===" + JSONObject.quote(agent)
            + "&&workspaceChecks.last.sessionId===" + JSONObject.quote("workspace-session-" + agent));
        for (int i = 0; i < 70 && !ui(() -> surface.showing()); i++) SystemClock.sleep(100);
        settle();
    }
    private void control(String name, Rect panel, String label) throws Exception {
        View view = tag(name); Rect measured = bounds(view);
        check(ui(() -> view.isShown()) && measured.width() >= dp(40) - 1 && measured.height() >= dp(40) - 1
            && panel.contains(measured) && measured.width() >= ui(() -> view.getWidth()) - 1 && measured.height() >= ui(() -> view.getHeight()) - 1,
            label + " complete at-least-40dp native target " + name);
        check(ui(() -> view.getContentDescription() != null && view.getContentDescription().length() > 0), label + " accessible label " + name);
    }
    private void readablePanel(String label, boolean keyboard) throws Exception {
        Rect available = bounds(surface), panel = bounds(tag("world-conversation-panel"));
        boolean constrainedIme = keyboard && available.height() < dp(170);
        if (constrainedIme) {
            check(panel.width() > dp(240) && panel.height() >= available.height() - 2 && available.contains(panel),
                label + " constrained IME gives composer the actual safe height; availablePx=" + available.height() + " panelPx=" + panel.height());
        } else {
            check(panel.width() > dp(240) && panel.height() > dp(170), label + " measured native reading panel");
            for (String name : new String[]{"telegram-back", "world-conversation-expand"}) control(name, panel, label);
        }
        // With only ~96dp above a real landscape IME, a full-height composer
        // must take precedence over the timeline/header. This branch still
        // rejects clipped/undersized media, mode and Send controls and editor.
        for (String name : new String[]{"telegram-attach", "telegram-mic", "telegram-send", "telegram-send-mode"}) control(name, panel, label);
        View inputView = tag("telegram-draft"); Rect input = bounds(inputView), timeline = bounds(tag("telegram-timeline"));
        check(panel.contains(input) && input.width() >= dp(96) && input.height() >= dp(40)
            && input.width() >= ui(() -> inputView.getWidth()) - 1 && input.height() >= ui(() -> inputView.getHeight()) - 1,
            label + " native editor is complete and useful; widthPx=" + input.width() + " heightPx=" + input.height());
        if (constrainedIme) {
            String recipient = new JSONObject(js("workspaceChecks.last")).getString("name");
            check(ui(() -> inputView.getContentDescription() != null && inputView.getContentDescription().toString().contains(recipient)),
                label + " constrained composer accessibility identifies exact recipient " + recipient);
        } else {
            check(panel.contains(timeline) && timeline.height() >= dp(keyboard ? 48 : 64), label + " real message list retains readable space");
        }
        scriptCheck("workspaceChecks.last.appScale===1.5", label + " actual native payload requests app150");
        // Android 14+ supports nonlinear SP conversion. scaledDensity is not a
        // valid multiplier for larger text on Android 35: use the same public
        // SP conversion as TextView.setTextSize. The app's saved editor base is
        // 16sp, and applyScale passes base * appScale = 24sp to that API.
        float actualPx = ui(() -> ((EditText) tag("telegram-draft")).getTextSize());
        float expectedPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 16f * 1.5f, activity.getResources().getDisplayMetrics());
        check(Math.abs(actualPx - expectedPx) <= 1f,
            label + " app150 text uses actual Android 24sp conversion; actualPx=" + actualPx + " expectedPx=" + expectedPx + " tolerancePx=1");
    }
    private void keyboardEvidence(String label) throws Exception {
        // Capture BEFORE layout requirements: future physical-IME failures need
        // their true safe viewport and image, not a later post-dismissal frame.
        JSONObject item = new JSONObject().put("label", label).put("nativeSafeViewport", rectJson(bounds(surface)))
            .put("nativePanel", rectJson(bounds(tag("world-conversation-panel")))).put("worldViewport", rectJson(bounds(web)))
            .put("density", activity.getResources().getDisplayMetrics().density).put("nativeFontScale", activity.getResources().getConfiguration().fontScale)
            .put("payload", new JSONObject(js("workspaceChecks.last"))).put("player", pose());
        for (String name : new String[]{"telegram-draft", "telegram-send", "telegram-attach", "telegram-mic", "telegram-send-mode", "telegram-timeline", "telegram-title"}) {
            View view = tag(name);
            item.put(name, ui(() -> new JSONObject().put("shown", view.isShown()).put("width", view.getWidth()).put("height", view.getHeight())
                .put("description", String.valueOf(view.getContentDescription()))).put("visibleBounds", rectJson(bounds(view))));
        }
        Bitmap shot = getUiAutomation().takeScreenshot();
        if (shot == null) throw new AssertionError("Keyboard screenshot unavailable");
        try (FileOutputStream out = new FileOutputStream(artifact(label + "-keyboard.png"))) { shot.compress(Bitmap.CompressFormat.PNG, 100, out); }
        finally { shot.recycle(); }
        write(label + "-keyboard.json", item);
    }
    private void screenshot(String label, boolean landscape, boolean expanded) throws Exception {
        settle();
        CountDownLatch frame = new CountDownLatch(1);
        runOnMainSync(() -> web.postVisualStateCallback(SystemClock.uptimeMillis(), new WebView.VisualStateCallback() { @Override public void onComplete(long id) { frame.countDown(); } }));
        if (!frame.await(8, TimeUnit.SECONDS)) throw new AssertionError("Retained world frame not committed");
        Bitmap shot = getUiAutomation().takeScreenshot(); if (shot == null) throw new AssertionError("Screenshot unavailable");
        Rect viewport = bounds(web), panel = bounds(tag("world-conversation-panel"));
        JSONObject item = new JSONObject().put("label", label).put("worldViewport", rectJson(viewport)).put("nativePanel", rectJson(panel)).put("player", pose());
        try {
            try (FileOutputStream out = new FileOutputStream(artifact(label + ".png"))) { shot.compress(Bitmap.CompressFormat.PNG, 100, out); }
            if (!expanded) {
                Rect exposed = landscape ? new Rect(viewport.left, viewport.top, panel.left - dp(8), viewport.bottom)
                    : new Rect(viewport.left, viewport.top, viewport.right, panel.top - dp(8));
                check(exposed.width() >= dp(120) && exposed.height() >= dp(90), label + " world remains visibly usable beside native conversation");
                JSONArray samples = new JSONArray(); int nonblack = 0, max = 0;
                for (int row = 1; row <= 5; row++) for (int col = 1; col <= 5; col++) {
                    int x = exposed.left + exposed.width() * col / 6, y = exposed.top + exposed.height() * row / 6;
                    int pixel = shot.getPixel(Math.max(0, Math.min(x, shot.getWidth() - 1)), Math.max(0, Math.min(y, shot.getHeight() - 1)));
                    int sum = ((pixel >> 16) & 255) + ((pixel >> 8) & 255) + (pixel & 255); samples.put(sum);
                    if (sum >= 9) nonblack++; max = Math.max(max, sum);
                }
                item.put("exposedWorld", rectJson(exposed)).put("pixelBrightness", samples).put("nonblack", nonblack).put("max", max);
                check(nonblack >= 12 && max >= 40, label + " screenshot contains actual retained world pixels, not a black uncovered region");
            }
        } finally { shot.recycle(); }
        write(label + ".json", item); evidence.put(item);
    }
    private void assertDock(boolean landscape, String label) throws Exception {
        Rect root = bounds(surface), panel = bounds(tag("world-conversation-panel"));
        check(root.contains(panel), label + " conversation dock stays within native safe viewport");
        if (landscape) check(panel.width() <= root.width() * .8 && Math.abs(panel.right - root.right) <= dp(2), label + " right dock leaves a substantial world region");
        else check(panel.height() <= root.height() * .85 && Math.abs(panel.bottom - root.bottom) <= dp(2), label + " bottom dock leaves a substantial world region");
        scriptCheck("(()=>{const c=document.getElementById('environment-canvas'),r=c.getBoundingClientRect();return document.body.dataset.view==='environment'&&r.width>=120&&r.height>=90&&r.left>=-2&&r.top>=-2&&r.right<=innerWidth+2&&r.bottom<=innerHeight+2&&getComputedStyle(c).visibility!=='hidden'&&getComputedStyle(c).display!=='none';})()", label + " real retained canvas remains visibly sized within the workspace while chatting");
        readablePanel(label, false);
    }
    private void callbacks(String agent) throws Exception {
        String exact = "EXACT WORKSPACE " + agent + "\nKeep this second line.";
        EditText input = (EditText) tag("telegram-draft");
        ui(() -> { input.setText(exact); return null; });
        waitJs("workspaceChecks.last.draft===" + JSONObject.quote(exact) + "&&workspaceChecks.last.can.send===true");
        int before = new JSONArray(js("workspaceChecks.calls")).length(); click("telegram-send");
        waitJs("workspaceChecks.calls.slice(" + before + ").some(c=>c.method==='POST'&&c.path==='/v1/message')");
        scriptCheck("workspaceChecks.calls.slice(" + before + ").filter(c=>c.path==='/v1/message').length===1&&workspaceChecks.calls.slice(" + before + ").some(c=>c.path==='/v1/message'&&c.body.agent===" + JSONObject.quote(agent)
            + "&&c.body.sessionId===" + JSONObject.quote("workspace-session-" + agent) + "&&c.body.text===" + JSONObject.quote(exact) + "&&c.body.echoToTelegram===false&&c.body.retry===false)", "real native Send admits exact synthetic draft once for " + agent);
        waitJs("workspaceChecks.last.draft===''&&workspaceChecks.last.outbox.length===0");
        click("telegram-attach");
        waitJs("workspaceChecks.last.attachments.some(a=>a.id===" + JSONObject.quote("workspace-file-" + agent) + ")");
        scriptCheck("workspaceChecks.calls.some(c=>c.method==='CHOOSE_FILE'&&c.agent===" + JSONObject.quote(agent) + ")", "real attachment action routes to fixture picker for " + agent);
        click("telegram-mic"); waitJs("workspaceChecks.last.recording===true");
        click("telegram-mic"); waitJs("workspaceChecks.last.recording===false&&workspaceChecks.last.attachments.length===2");
        scriptCheck("workspaceChecks.calls.some(c=>c.method==='START_RECORDING'&&c.agent===" + JSONObject.quote(agent) + ")&&workspaceChecks.calls.some(c=>c.method==='STOP_RECORDING'&&c.agent===" + JSONObject.quote(agent) + ")", "real voice start/finish callbacks keep exact fixture recipient " + agent);
        click("telegram-send");
        waitJs("workspaceChecks.last.attachments.length===0&&workspaceChecks.last.outbox.length===0");
        scriptCheck("workspaceChecks.calls.some(c=>c.path==='/v1/message'&&c.body.agent===" + JSONObject.quote(agent) + "&&c.body.text===''&&c.body.attachmentIds?.includes(" + JSONObject.quote("workspace-file-" + agent)
            + ")&&c.body.attachmentIds?.includes(" + JSONObject.quote("workspace-voice-" + agent) + "))", "native file+voice submission uses both original fixture IDs for " + agent);
        waitJs("workspaceChecks.last.can.abort===true&&workspaceChecks.last.controlRunId===" + JSONObject.quote("workspace-run-" + agent));
        click("telegram-stop-run");
        waitJs("workspaceChecks.calls.some(c=>c.path==='/v1/abort'&&c.body.agent===" + JSONObject.quote(agent) + ")");
        scriptCheck("workspaceChecks.calls.some(c=>c.path==='/v1/abort'&&c.body.agent===" + JSONObject.quote(agent) + "&&c.body.sessionId===" + JSONObject.quote("workspace-session-" + agent)
            + "&&c.body.runId===" + JSONObject.quote("workspace-run-" + agent) + "&&c.body.automaticContinuation==='hold'&&c.body.retry===false)", "native Stop remains exact-run and explicit hold in fixture for " + agent);
    }
    private void keyboard(String label, JSONObject atOpen) throws Exception {
        EditText input = (EditText) tag("telegram-draft");
        String exact = "Keyboard draft\nRetained without dispatch";
        ui(() -> { input.requestFocus(); input.setText(exact); ((InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(input, InputMethodManager.SHOW_IMPLICIT); return null; });
        boolean ime = false;
        for (int i = 0; i < 60; i++) {
            ime = ui(() -> { WindowInsets insets = activity.getWindow().getDecorView().getRootWindowInsets(); return insets != null && insets.isVisible(WindowInsets.Type.ime()); });
            if (ime) break; SystemClock.sleep(100);
        }
        check(ime, label + " actual Android keyboard is open, not a CSS simulation");
        settle(); keyboardEvidence(label); readablePanel(label + " keyboard", true);
        check(input == tag("telegram-draft") && ui(() -> input.hasFocus() && exact.equals(input.getText().toString())), label + " same focused native editor preserves exact multiline draft without hidden replacement");
        scriptCheck("workspaceChecks.last.draft===" + JSONObject.quote(exact) + "&&document.getElementById('draft').value===" + JSONObject.quote(exact), label + " actual native text and saved reducer draft remain identical while keyboard is open");
        AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow();
        check(root != null && !root.findAccessibilityNodeInfosByText("Keyboard draft").isEmpty(), label + " real accessibility tree exposes the native editor text");
        samePose(atOpen, label + " typing");
        ui(() -> { ((InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(), 0); input.clearFocus(); return null; });
        for (int i = 0; i < 60; i++) {
            if (!ui(() -> { WindowInsets insets = activity.getWindow().getDecorView().getRootWindowInsets(); return insets != null && insets.isVisible(WindowInsets.Type.ime()); })) break;
            SystemClock.sleep(100);
        }
        settle(); check(ui(() -> surface.showing()), label + " dismissing keyboard leaves the conversation open");
        ui(() -> { input.setText(""); return null; }); waitJs("workspaceChecks.last.draft===''");
    }
    private void orientation(boolean landscape) throws Exception {
        String label = landscape ? "landscape-font150" : "portrait-font150";
        runOnMainSync(() -> activity.setRequestedOrientation(landscape ? ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        waitJs(landscape ? "innerWidth>innerHeight" : "innerHeight>innerWidth"); SystemClock.sleep(250); settle();
        seedNondefaultPose(label);
        JSONObject before = pose();
        for (String agent : AGENTS) {
            open(agent); assertDock(landscape, label + " " + agent); samePose(before, label + " select " + agent);
            scriptCheck("workspaceChecks.last.messages.some(m=>m.text.includes(" + JSONObject.quote("WORKSPACE EXACT PUBLIC " + agent) + "))", label + " native timeline receives exact selected public history for " + agent);
            callbacks(agent); samePose(before, label + " send/files/voice/control " + agent);
            if ("atlas".equals(agent)) {
                screenshot(label + "-dock", landscape, false); keyboard(label, before);
                Rect collapsed = bounds(tag("world-conversation-panel"));
                click("world-conversation-expand"); waitJs("workspaceChecks.last.worldExpanded===true"); settle();
                Rect expanded = bounds(tag("world-conversation-panel"));
                check((long) expanded.width() * expanded.height() > (long) collapsed.width() * collapsed.height() * 1.15, label + " native expand materially enlarges the same panel");
                readablePanel(label + " expanded", false); screenshot(label + "-expanded", landscape, true);
                click("world-conversation-expand"); waitJs("workspaceChecks.last.worldExpanded===false"); settle();
                assertDock(landscape, label + " collapsed"); samePose(before, label + " collapse");
                scriptCheck("workspaceChecks.actions.some(e=>e.action==='worldExpand'&&e.data.expanded===true)&&workspaceChecks.actions.some(e=>e.action==='worldExpand'&&e.data.expanded===false)", label + " real native expand and collapse emit explicit action values");
                runOnMainSync(() -> activity.onBackPressed()); waitJs("workspaceChecks.last.chat===false&&workspaceChecks.last.world===true"); settle();
                check(!activity.isFinishing(), label + " Android Back closes the conversation without replacing or finishing the operating space");
                samePose(before, label + " hardware Back"); open(agent);
            }
            click("telegram-back"); waitJs("workspaceChecks.last.chat===false&&workspaceChecks.last.world===true"); settle();
            check(!ui(() -> surface.showing()), label + " Close removes only the native conversation panel for " + agent);
            samePose(before, label + " Close " + agent);
        }
    }

    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            activity = startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(), "org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            waitForIdleSync(); check(activityField("profile") == null, "mandatory unpaired target has no production profile");
            check(Math.abs(activity.getResources().getConfiguration().fontScale - 1.5f) < .02, "actual Android native font is 150 percent");
            web = (WebView) activityField("web"); surface = (TelegramSurface) activityField("telegram"); waitJs("!!window.DracoWatch");
            savedCache = js("localStorage.getItem('" + CACHE + "')");
            js("window.workspaceReloadSentinel=true;localStorage.setItem('" + CACHE + "',JSON.stringify({drafts:{},pins:[],pinHistory:[],outbox:[],attachments:[],preferences:{scale:150,motion:true,rendering:'light',echoToTelegram:false,automaticSpeech:false,playbackRate:1}}));true");
            runOnMainSync(() -> web.reload()); waitJs("document.readyState==='complete'&&typeof workspaceReloadSentinel==='undefined'&&!!window.DracoWatch");
            installFixture(); js("DracoWatch.view('environment');true"); waitJs("workspaceChecks.last.view==='environment'");
            orientation(false); orientation(true);
            check(activityField("profile") == null, "target remains unpaired after all native workflows");
            scriptCheck("workspaceChecks.calls.every(c=>['REFRESH','CHOOSE_FILE','START_RECORDING','STOP_RECORDING','CANCEL_FILE','RELEASE_FILE','CONFIRM'].includes(c.method)||c.method==='GET'&&c.path.startsWith('/v1/capabilities?')||c.method==='POST'&&['/v1/message','/v1/abort','/v1/diagnostics'].includes(c.path))", "all admissions, controls, picker and recorder calls stayed inside the installed synthetic fixture");
            write("summary.json", new JSONObject().put("checks", checks).put("scope", "Unpaired isolated emulator, synthetic callbacks and admissions, real native/web/IME/screenshots; no physical-phone acceptance, production input, microphone or playback").put("orientations", evidence));
            result.putString("stream", "Workspace checks passed: " + checks + ". Real retained world/native conversation, six exact recipients, keyboard, scale150, expand/Back; synthetic admissions/files/voice only.\n");
            finish(0, result);
        } catch (Throwable error) {
            android.util.Log.e("DracoWorkspaceCheck", "FAIL after " + checks, error);
            result.putString("stream", "Workspace checks failed after " + checks + ": " + error + "\n");
            if (web != null && surface != null) try { failureEvidence(error); } catch (Throwable captureError) { android.util.Log.e("DracoWorkspaceCheck", "Failed to save fixture failure evidence", captureError); }
            try { Bitmap shot = getUiAutomation().takeScreenshot(); if (shot != null) { try (FileOutputStream out = new FileOutputStream(artifact("failure-screen.png"))) { shot.compress(Bitmap.CompressFormat.PNG, 100, out); } shot.recycle(); } } catch (Throwable ignored) { }
            finish(1, result);
        } finally {
            if (web != null) try {
                js("clearInterval(window.workspaceChecks?.timer);true");
                if (savedCache != null) js("(()=>{const saved=" + savedCache + ";if(saved===null)localStorage.removeItem('" + CACHE + "');else localStorage.setItem('" + CACHE + "',saved);return true;})()");
            } catch (Throwable ignored) { }
            if (activity != null) runOnMainSync(() -> activity.finish());
        }
    }
}
