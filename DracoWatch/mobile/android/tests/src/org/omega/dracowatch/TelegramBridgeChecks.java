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
import android.view.MotionEvent;
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
    private boolean flag(String key) { Object value = arguments.get(key); return value instanceof Boolean ? (Boolean) value : Boolean.parseBoolean(String.valueOf(value)); }
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
    private View revealRowControl(String control) throws Exception {
        ListView list=(ListView)requireTag("telegram-timeline");
        int index=ui(()->{for(int i=0;i<list.getAdapter().getCount();i++)if(list.getAdapter().getView(i,null,list).findViewWithTag(control)!=null)return i;return -1;});
        if(index<0)throw new AssertionError("Actual native adapter has no control "+control);
        ui(()->{list.setSelection(index);return null;});waitForIdleSync();
        for(int i=0;i<30;i++){View v=tag(control);if(v!=null)return v;SystemClock.sleep(80);}
        throw new AssertionError("Actual native work row did not become visible: "+control);
    }
    private AccessibilityNodeInfo exactNode(String label) {
        AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow(); if (root == null) return null;
        for (AccessibilityNodeInfo n : root.findAccessibilityNodeInfosByText(label)) if (n.getText() != null && label.equalsIgnoreCase(n.getText().toString())) return n;
        return null;
    }
    private boolean scrollDialog(AccessibilityNodeInfo n) {
        if (n == null) return false;
        if (n.isScrollable() && n.getClassName() != null && n.getClassName().toString().contains("ListView") && n.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)) return true;
        for (int i = 0; i < n.getChildCount(); i++) if (scrollDialog(n.getChild(i))) return true;
        return false;
    }
    private void dialogChoice(String label) throws Exception {
        AccessibilityNodeInfo n = null;
        for (int i = 0; i < 40; i++) { n = exactNode(label); if (n != null && n.isVisibleToUser()) break; scrollDialog(getUiAutomation().getRootInActiveWindow()); n = null; SystemClock.sleep(80); }
        if (n == null) throw new AssertionError("Native dialog choice missing: " + label);
        for (int i = 0; i < 5 && !n.isClickable() && n.getParent() != null; i++) n = n.getParent();
        boolean clicked = n.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        if (!clicked) {
            // Some Android ListView dialog rows advertise no clickable action
            // through their text node/parent despite occupying a touch target.
            // Inject a genuine screen tap, never call the app callback directly.
            AccessibilityNodeInfo fresh = exactNode(label);
            if (fresh != null) n = fresh;
            n.refresh(); Rect bounds = new Rect(); n.getBoundsInScreen(bounds);
            if (bounds.isEmpty() || !n.isVisibleToUser()) throw new AssertionError("Native dialog target is not visible: " + label);
            long at = SystemClock.uptimeMillis();
            MotionEvent down = MotionEvent.obtain(at, at, MotionEvent.ACTION_DOWN, bounds.exactCenterX(), bounds.exactCenterY(), 0);
            MotionEvent up = MotionEvent.obtain(at, at + 80, MotionEvent.ACTION_UP, bounds.exactCenterX(), bounds.exactCenterY(), 0);
            try {
                boolean downAccepted = getUiAutomation().injectInputEvent(down, true);
                boolean upAccepted = getUiAutomation().injectInputEvent(up, true);
                clicked = downAccepted && upAccepted;
            }
            finally { down.recycle(); up.recycle(); }
        }
        check(clicked, "native dialog choice: " + label); waitForIdleSync();
    }
    private void installTestBoundary() throws Exception {
        // Preserve the genuine Java bridge render call. No network/input/media
        // method crosses the test boundary; every attempted operation is logged.
        js("(()=>{const actual=window.DracoNative;window.bridgeChecks={renderCount:0,calls:[],actions:[],actualRender:typeof actual.renderTelegram==='function'};"
            + "window.DracoNative={renderTelegram(value){bridgeChecks.renderCount++;actual.renderTelegram(value);},notifyTelegram(){},"
            + "refresh(agent){bridgeChecks.calls.push({method:'REFRESH',agent});},"
            + "request(id,method,path,body){bridgeChecks.calls.push({method,path,body});setTimeout(()=>{const agent=new URL('https://fixture.invalid'+path).searchParams.get('agent');let data={agent,sessionId:'bridge-physical-'+agent,send:false,queue:false,steer:false,strictSteer:false,abort:false,reply:false,speech:false,attachments:false,commands:[]};if(method==='GET'&&bridgeChecks.ownerPath&&path===bridgeChecks.ownerPath+'&offset=0&limit=32768&revealCredentials=false'){const {url,revision,...identity}=bridgeChecks.ownerRef;data={schema:'draco.owner-work-detail.v1',identity,revision,text:bridgeChecks.ownerText,offset:0,nextOffset:null,totalChars:bridgeChecks.ownerText.length,complete:true,credentialMode:'masked',sourceTruncated:false};}onDracoResponse({id,ok:true,status:200,data});},0);},"
            + "stopMedia(){bridgeChecks.calls.push({method:'STOP-MEDIA'});},playMedia(){bridgeChecks.calls.push({method:'PLAY-MEDIA'});},setPlaybackRate(){},hideKeyboard(){actual.hideKeyboard();},nativeDiagnostics(){return actual.nativeDiagnostics();},recordDiagnostic(value){actual.recordDiagnostic(value);}};"
            + "const handler=window.onDracoTelegramAction;window.onDracoTelegramAction=event=>{bridgeChecks.actions.push(JSON.parse(JSON.stringify(event)));return handler(event);};"
            + "window.bridgeFixture=()=>{const ids=['main','forge','atlas','aera-new','vvv','daedalus'],now=Date.now(),message={id:" + JSONObject.quote(MESSAGE) + ",agent:'atlas',sessionId:'" + SESSION + "',role:'assistant',text:" + JSONObject.quote(PUBLIC_TEXT) + ",timestamp:now-1000,kind:'Public report',publicAttested:true,source:'authenticated-native-history',media:[]};"
            + "return {version:2,connected:true,lastSuccess:now,capturedAt:now,selectedAgent:'atlas',agents:ids.map(id=>({id,status:id==='atlas'?'active':'idle',sessionId:'bridge-physical-'+id,sessionKey:'bridge:'+id,capabilities:{send:false,queue:false,steer:false,abort:false},controlTargets:[]})),conversation:[message,{id:'bridge-private-denied',agent:'atlas',sessionId:'" + SESSION + "',role:'assistant',text:'PRIVATE MUST NEVER REACH NATIVE',timestamp:now,publicAttested:false,source:'private-peer'}],historyState:{status:'complete'},historyHasMore:false,fleetCoverage:ids.map(agent=>({agent,available:true,status:'recorded-window'})),fleetActivity:[message],workActivity:[]};};"
            + "onDracoSnapshot(bridgeFixture());DracoWatch.select('atlas');return true;})()");
        waitShowing(true); waitRows(PUBLIC_TEXT);
    }
    private void assertBoundary(String label) throws Exception {
        jsCheck("bridgeChecks.actualRender&&bridgeChecks.renderCount>0", label + " uses real Java renderTelegram, not a substitute native renderer");
        jsCheck("bridgeChecks.calls.every(c=>c.method==='REFRESH'||c.method==='STOP-MEDIA'||c.method==='GET'&&(c.path.startsWith('/v1/capabilities?')||c.path==='/v1/diagnostics'||bridgeChecks.ownerPath&&c.path===bridgeChecks.ownerPath+'&offset=0&limit=32768&revealCredentials=false')||c.method==='POST'&&c.path==='/v1/diagnostics'&&(()=>{const b=JSON.parse(c.body);return Array.isArray(b.events)&&b.events.length<=20&&b.events.every(e=>!('body'in e)&&!('token'in e)&&!('query'in e));})())", label + " performed only exact synthetic owner-detail/capability reads and metadata diagnostics, no message/control POST, audio playback or synthesis");
        check(field("profile").get(activity) == null, label + " remains unpaired with no production credentials");
    }
    private void screenshot(String name) throws Exception {
        if (!flag("screenshots")) return;
        // Deliberate unavailable-control checks show LENGTH_LONG refusal toasts.
        // Evidence must show the app rather than the temporary system overlay.
        waitForIdleSync(); SystemClock.sleep("integrated-pinned-chat".equals(name) ? 7500 : 3700); Bitmap shot = getUiAutomation().takeScreenshot();
        if (shot == null) throw new AssertionError("Screenshot unavailable");
        File dir = new File(getTargetContext().getExternalFilesDir(null), "telegram-bridge-checks"); if (!dir.exists() && !dir.mkdirs()) throw new AssertionError("Screenshot directory unavailable");
        File file = new File(dir, name + "-font" + Math.round(activity.getResources().getConfiguration().fontScale * 100) + ".png");
        try (FileOutputStream out = new FileOutputStream(file)) { shot.compress(Bitmap.CompressFormat.PNG, 100, out); } finally { shot.recycle(); }
    }
    private void executionPreviewCase() throws Exception {
        js("(()=>{const x=bridgeFixture(),now=Date.now(),scope={agent:'atlas',sessionId:'"+SESSION+"',sessionKey:'bridge:atlas',runId:'bridge-execution-run',callId:'bridge-execution-call'};"
            +"const detailRef={...scope,recordId:'record:bridge-execution-source',revision:'8'.repeat(64)};detailRef.url='/v1/work/detail?'+new URLSearchParams(detailRef).toString();bridgeChecks.ownerRef=detailRef;bridgeChecks.ownerPath=detailRef.url;bridgeChecks.ownerText=JSON.stringify({toolName:'functions.exec_command',phase:'result',input:{cmd:'synthetic exact command'},result:{exitCode:2,output:'EXACT_SYNTHETIC_OWNER_RECORD'}},null,2);"
            +"x.workActivity=[{...scope,id:'bridge-execution-card',role:'assistant',kind:'Tool finished',text:'Observed shell command result',timestamp:now,source:'authenticated-tool-status',publicAttested:true,evidenceRevision:'8'.repeat(64),detailRef,evidenceSource:{kind:'recorded-history',sequence:9,projectionRevision:1,observedAt:now,freshUntil:now+15000},observation:{...scope,version:1,tool:'exec_command',toolName:'functions.exec_command',phase:'result',redacted:true,command:{program:'rg',operation:'search',flags:['-n'],targets:['mobile/ui/app.js'],preview:'rg -n \"steer|chat.abort\" mobile/ui/app.js'},result:{exitCode:2,summary:'Safe observed output: command inspected Stop and Steer controls.'},privateModelContext:'PRIVATE_EXECUTION_CONTEXT_MUST_NOT_RENDER',gaps:[]}}];onDracoSnapshot(x);DracoWatch.select('atlas');return true;})()");
        waitShowing(true);waitRows("$ rg -n");
        String text=rowsText();
        check(text.contains("$ rg -n \"steer|chat.abort\" mobile/ui/app.js")&&text.contains("Exit 2")
            &&text.contains("Safe observed output: command inspected Stop and Steer controls."),
            "actual app.js to native bridge keeps safe command exit and output visible inline before expansion");
        check(tag("telegram-evidence-bridge-execution-card")==null&&!text.contains("PRIVATE_EXECUTION_CONTEXT_MUST_NOT_RENDER"),
            "actual inline execution does not require provenance expansion and never renders private context");
        revealRowControl("telegram-expand-bridge-execution-card");
        screenshot("integrated-execution-inline");
        int ownerCallsBefore=Integer.parseInt(js("bridgeChecks.calls.filter(c=>c.path&&c.path.startsWith('/v1/work/detail?')).length"));
        js("onDracoTelegramAction({action:'ownerDetail',data:{id:'bridge-execution-card',agent:'atlas',sessionId:'WRONG-OWNER-SESSION',revision:'8'.repeat(64)}})");
        jsCheck("!document.getElementById('owner-record-dialog').open&&bridgeChecks.calls.filter(c=>c.path&&c.path.startsWith('/v1/work/detail?')).length==="+ownerCallsBefore,"stale physical-session Recorded detail action cannot fetch or open another owner record");
        click(revealRowControl("telegram-owner-detail-bridge-execution-card"));
        waitShowing(false);waitJs("document.getElementById('owner-record-dialog').open&&document.getElementById('owner-record-content').textContent.includes('EXACT_SYNTHETIC_OWNER_RECORD')");
        jsCheck("bridgeChecks.actions.some(e=>e.action==='ownerDetail'&&e.data.agent==='atlas'&&e.data.sessionId==='"+SESSION+"'&&e.data.id==='bridge-execution-card'&&e.data.revision==='8'.repeat(64))","actual native Recorded detail action retains exact owner physical session event and revision");
        jsCheck("bridgeChecks.calls.filter(c=>c.path&&c.path.startsWith('/v1/work/detail?')).length==="+(ownerCallsBefore+1)+"&&document.getElementById('owner-record-content').textContent===bridgeChecks.ownerText","explicit native Recorded detail fetch opens the complete exact synthetic retained payload, not its compact preview");
        String encodedOwnerPath=js("bridgeChecks.calls.find(c=>c.path&&c.path.startsWith('/v1/work/detail?')).path");
        String exactOwnerPath=new JSONArray("["+encodedOwnerPath+"]").getString(0);
        check(DracoClient.permitted("GET",exactOwnerPath),"actual owner-detail route emitted by JavaScript is admitted by the native exact-query guard");
        js("document.getElementById('owner-record-close').click()");waitShowing(true);
    }
    private void publicProgressCase() throws Exception {
        js("(()=>{const x=bridgeFixture(),now=Date.now(),scope={agent:'atlas',sessionId:'"+SESSION+"',sessionKey:'bridge:atlas',runId:'bridge-owned-run',callId:'bridge-progress-call'};"
            +"x.workActivity=[{...scope,id:'bridge-progress-card',role:'assistant',kind:'Tool started',text:'Task progress 1/3 · Current: Integrate native controls',timestamp:now,source:'authenticated-tool-status',publicAttested:true,evidenceRevision:'7'.repeat(64),evidenceSource:{kind:'recorded-history',sequence:8,projectionRevision:1,observedAt:now,freshUntil:now+15000},observation:{...scope,version:1,tool:'progress_card',toolName:'functions.progress_card',phase:'start',redacted:true,taskProgress:{version:1,source:'operator-progress-card',completed:99,total:99,current:'FORGED_DERIVED_VALUE',steps:[{step:'Preserve current release',status:'completed'},{step:'Integrate native controls',status:'in_progress'},{step:'Verify live operational stream',status:'pending'}]},privateModelContext:'PRIVATE_CONTEXT_SHOULD_NOT_BE_RENDERED',gaps:[]}}];onDracoSnapshot(x);DracoWatch.select('atlas');return true;})()");
        waitShowing(true); waitRows("Task progress 1/3");
        String inlineRows = rowsText();
        check(inlineRows.contains("Reported task checklist") && inlineRows.contains("[✓] Preserve current release")
            && inlineRows.contains("[→] Integrate native controls · reported current step") && inlineRows.contains("[ ] Verify live operational stream"),
            "actual JS-to-native bridge exposes completed current pending public checklist steps before evidence expansion");
        check(tag("telegram-evidence-bridge-progress-card") == null,
            "inline public checklist does not depend on opening optional provenance");
        revealRowControl("telegram-expand-bridge-progress-card");
        screenshot("integrated-public-progress-inline");
        click(revealRowControl("telegram-expand-bridge-progress-card"));
        TextView evidence=(TextView)requireTag("telegram-evidence-bridge-progress-card");String detail=ui(()->evidence.getText().toString());
        check(detail.contains("Task progress: 1/3 complete")&&detail.contains("Reported current step: Integrate native controls"),"actual bridge/native public progress recomputes completed count and current step rather than trusting derived fields");
        check(detail.contains("☑ Preserve current release")&&detail.contains("▶ Integrate native controls")&&detail.contains("☐ Verify live operational stream"),"native read-only evidence retains the explicit completed/current/pending checklist");
        check(detail.contains("bridge:atlas")&&detail.contains(""+SESSION)&&detail.contains("bridge-owned-run")&&detail.contains("bridge-progress-call"),"native public progress detail remains bound to exact supplied owner session/run/call");
        check(!rowsText().contains("PRIVATE_CONTEXT_SHOULD_NOT_BE_RENDERED")&&!detail.contains("FORGED_DERIVED_VALUE")&&detail.contains("not private planning"),"public progress rendering excludes private extras and labels its operator-visible source");
        screenshot("integrated-public-progress");
    }
    private int dp(float value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
    private void readableControl(String id, Rect root, String label) throws Exception {
        View v = requireTag(id); if (!ui(() -> v.isShown())) return;
        Rect r = ui(() -> { Rect measured = new Rect(); v.getGlobalVisibleRect(measured); return measured; });
        int width = ui(() -> v.getWidth()), height = ui(() -> v.getHeight());
        boolean complete = r.width() >= dp(40) - 1 && r.height() >= dp(40) - 1 && r.width() >= width - 1 && r.height() >= height - 1
            && r.left >= root.left - 1 && r.right <= root.right + 1 && r.top >= root.top - 1 && r.bottom <= root.bottom + 1;
        check(complete, label + " " + id + " has a complete at-least-40dp touch target"
            + (complete ? "" : " (visible=" + r.toShortString() + ", measured=" + width + "×" + height + ", minimum=" + dp(40) + "px)"));
        check(ui(() -> v.getContentDescription() != null && v.getContentDescription().length() > 0), label + " " + id + " retains accessible action semantics");
        if (v instanceof TextView) { TextView text = (TextView) v;
            if (ui(() -> text.getText().length()) == 0) check(ui(() -> { for (android.graphics.drawable.Drawable d : text.getCompoundDrawables()) if (d != null) return true; return false; }), label + " " + id + " renders a real native icon rather than an empty action");
            else check(ui(() -> text.getLayout() != null && text.getLayout().getLineCount() == 1 && text.getLayout().getEllipsisCount(0) == 0
                && text.getPaint().measureText(text.getText().toString()) <= text.getWidth() - text.getCompoundPaddingLeft() - text.getCompoundPaddingRight() + 1), label + " " + id + " has no syllable-wrapped, ellipsized or clipped control label"); }
    }
    private void assertLayout(String label) throws Exception {
        Rect bounds = ui(() -> { Rect r = new Rect(); surface.getGlobalVisibleRect(r); return r; });
        check(bounds.width() > 0 && bounds.height() > 0, label + " integrated native surface has an actual viewport");
        for (String key : new String[]{"telegram-navigation", "telegram-composer", "telegram-send", "telegram-draft"}) {
            View v = requireTag(key); Rect r = ui(() -> { Rect measured = new Rect(); v.getGlobalVisibleRect(measured); return measured; });
            check(r.width() > 0 && r.height() > 0 && r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1, label + " integrated " + key + " fits within actual viewport");
        }
        ListView list = (ListView) requireTag("telegram-timeline"); View composer = requireTag("telegram-composer"); EditText draft = (EditText) requireTag("telegram-draft");
        int line = ui(() -> { for (int i = 0; i < list.getAdapter().getCount(); i++) for (View v : descendants(list.getAdapter().getView(i, null, list)))
            if (v instanceof TextView && PUBLIC_TEXT.equals(((TextView) v).getText().toString())) return ((TextView) v).getLineHeight(); return 0; });
        check(line > 0, label + " measures actual native full-message typography");
        int height = ui(() -> list.getHeight()), useful = ui(() -> list.getHeight() - list.getPaddingTop() - list.getPaddingBottom()), composerHeight = ui(() -> composer.getHeight());
        android.util.Log.i("DracoTelegramBridge", "LAYOUT " + label + " root=" + bounds.height() + " timeline=" + height + " useful=" + useful + " messageLine=" + line + " composer=" + composerHeight + " draft=" + ui(() -> draft.getHeight()));
        boolean shortHeight = bounds.height() < dp(480);
        int usefulMinimum = shortHeight ? Math.max(dp(64), Math.min(2 * line, (int) Math.floor(bounds.height() * .28))) : Math.max(dp(120), 3 * line);
        check(height >= Math.ceil(bounds.height() * (shortHeight ? .28 : .30)), label + " integrated messages retain a meaningful " + (shortHeight ? "compact-height" : "portrait") + " viewport share");
        check(useful >= usefulMinimum, label + " useful message viewport retains readable lines after padding; required=" + usefulMinimum + " actual=" + useful);
        check(composerHeight <= Math.floor(bounds.height() * (shortHeight ? .34 : .24)), label + " bounded integrated composer leaves useful message space");
        check(ui(() -> draft.getWidth()) >= dp(100), label + " draft retains a useful at-least-100dp typing width");
        check(ui(() -> draft.getHeight()) <= Math.max(dp(96), 3 * ui(() -> draft.getLineHeight()) + ui(() -> draft.getCompoundPaddingTop() + draft.getCompoundPaddingBottom())), label + " exact draft stays inside bounded multiline editor");
        for (String id : new String[]{"telegram-send", "telegram-send-mode", "telegram-mic", "telegram-attach", "telegram-stop-run", "telegram-options", "telegram-pin-options", "telegram-speed", "telegram-stop-audio", "telegram-nav-chats", "telegram-nav-chamber", "telegram-nav-environment", "telegram-nav-activity", "telegram-nav-settings"}) readableControl(id, bounds, label);
        if (flag("requireFont150")) check(activity.getResources().getConfiguration().fontScale >= 1.49f, "actual native Android font is 150 percent");
    }
    private void workflowCase() throws Exception {
        js("(()=>{window.confirm=()=>true;const old=DracoNative.request;DracoNative.request=(id,method,path,body)=>{if(method==='GET'&&path.startsWith('/v1/capabilities?')){bridgeChecks.calls.push({method,path});setTimeout(()=>onDracoResponse({id,ok:true,data:{agent:'atlas',sessionId:'"+SESSION+"',send:true,queue:true,abort:true,durableStop:true,strictSteer:true,attachments:true,voice:true}}),0);}else if(path==='/v1/hold/release'){bridgeChecks.calls.push({id,method,path,body:JSON.parse(body)});}else old(id,method,path,body);};"
            +"bridgeChecks.workflow=hold=>{const x=bridgeFixture(),a=x.agents.find(a=>a.id==='atlas');a.sessionKey='agent:atlas:telegram:direct:8745908879';a.conversationStatus='active';a.capabilities={send:!hold,queue:!hold,abort:true,durableStop:true,strictSteer:!hold,releaseHold:!!hold};a.controlTargets=[{agent:'atlas',sessionKey:a.sessionKey,sessionId:a.sessionId,runId:'workflow-run',scope:'conversation'}];a.runPhase={phase:'tool-wait',runId:'workflow-run',observedAt:Date.now(),expiresAt:Date.now()+15000};if(hold)a.continuationHold={id:hold,sessionId:a.sessionId,heldAt:Date.now()};return x;};bridgeChecks.workflowAction=(action,data={})=>onDracoTelegramAction({action,data:{agent:'atlas',sessionId:'"+SESSION+"',sessionKey:'agent:atlas:telegram:direct:8745908879',runId:'workflow-run',...data}});onDracoConnection({state:'offline'});onDracoSnapshot(bridgeChecks.workflow(null));DracoWatch.select('atlas');return true;})()");
        waitShowing(true);
        for(int i=0;i<100&&!ui(()->((TextView)requireTag("telegram-stop-run")).getText().toString()).equals("Stop & hold");i++)SystemClock.sleep(50);
        js("bridgeChecks.workflowAction('draft',{text:'UNSENT WORKFLOW DRAFT'})");
        for(int i=0;i<100&&ui(()->requireTag("telegram-send").getAlpha())<1f;i++)SystemClock.sleep(50);
        check(ui(()->requireTag("telegram-send").getAlpha())==1f,"native fresh send available before hold");
        check(ui(()->((TextView)requireTag("telegram-stop-run")).getText().toString()).equals("Stop & hold"),"real bridge carries advertised durable Stop label");
        js("bridgeChecks.workflowAction('draft',{text:'UNSENT WORKFLOW DRAFT'});onDracoSnapshot(bridgeChecks.workflow('hold-one'))");waitForIdleSync();
        for(int i=0;i<100&&ui(()->requireTag("telegram-send").getAlpha())==1f;i++)SystemClock.sleep(50);
        check(ui(()->requireTag("telegram-send").getAlpha())<1f,"real bridge revokes cached Send when hold arrives");
        click(requireTag("telegram-send"));
        jsCheck("!bridgeChecks.calls.some(c=>c.path==='/v1/message')","unavailable native Send dispatches nothing and preserves the draft");
        String status=ui(()->((TextView)requireTag("telegram-status")).getText().toString());
        check(status.contains("Waiting for tool")&&status.contains("Automatic continuation held"),"native header distinguishes tool wait from continuation hold");
        screenshot("workflow-held-chat");
        js("bridgeChecks.workflowAction('details')");waitShowing(false);
        jsCheck("!!document.getElementById('release-continuation-hold')&&!document.getElementById('release-continuation-hold').disabled","actual WebView details offers exact hold release");
        js("onDracoSnapshot(bridgeChecks.workflow('hold-two'));document.getElementById('release-continuation-hold').click()");
        jsCheck("!bridgeChecks.calls.some(c=>c.path==='/v1/hold/release')","stale Android details cannot release replacement hold");
        js("document.getElementById('details-dialog').close();bridgeChecks.workflowAction('details');document.getElementById('release-continuation-hold').click()");
        waitJs("bridgeChecks.calls.some(c=>c.path==='/v1/hold/release')");
        jsCheck("(()=>{const r=bridgeChecks.calls.filter(c=>c.path==='/v1/hold/release');return r.length===1&&r[0].body.holdId==='hold-two'&&r[0].body.sessionId==='"+SESSION+"'&&r[0].body.sessionKey==='agent:atlas:telegram:direct:8745908879';})()","Android release dispatch keeps exact displayed hold and physical session");
        js("(()=>{const r=bridgeChecks.calls.find(c=>c.path==='/v1/hold/release');onDracoResponse({id:r.id,ok:true,data:{...r.body,id:r.body.idempotencyKey,status:'hold-released'}});onDracoSnapshot(bridgeChecks.workflow(null));})()");waitShowing(true);SystemClock.sleep(200);
        jsCheck("JSON.parse(localStorage.getItem('"+CACHE+"')).drafts.atlas==='UNSENT WORKFLOW DRAFT'","release leaves Android exact unsent draft intact");
        jsCheck("bridgeChecks.calls.every(c=>c.method!=='POST'||c.path==='/v1/hold/release'||c.path==='/v1/diagnostics')&&!bridgeChecks.calls.some(c=>c.method==='PLAY-MEDIA')","only synthetic release and metadata posts; no work, media or source replay");
        check(field("profile").get(activity)==null,"workflow bridge remains unpaired");
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
            if (flag("workflowOnly")) {
                workflowCase();
                result.putString("stream", "Targeted workflow bridge checks passed: " + checks + ". Actual unpaired Activity/WebView/native controls, fresh phase/hold revocation and exact synthetic release; no live input or control.\n");
                finish(0, result);
                return;
            }
            if (flag("executionOnly")) {
                assertLayout("targeted final 100 percent app scale");
                screenshot("integrated-restored-chat");
                click(requireTag("telegram-nav-chats"));
                waitShowing(true);
                for(int i=0;i<100&&!ui(()->((TextView)requireTag("telegram-title")).getText().toString()).equals("DRACO WATCH");i++)SystemClock.sleep(100);
                check(ui(()->((TextView)requireTag("telegram-title")).getText().toString()).equals("DRACO WATCH"),"actual final bridge shows restored Watch roster brand");
                screenshot("integrated-restored-roster");
                js("DracoWatch.select('atlas')");waitShowing(true);waitRows(PUBLIC_TEXT);
                executionPreviewCase();
                publicProgressCase();
                assertBoundary("targeted inline execution bridge");
                result.putString("stream", "Targeted inline execution bridge checks passed: " + checks + ". Actual unpaired Activity/WebView/native restored roster, chat, mode-selector layout, command-result preview and public checklist; no production input/audio.\n");
                finish(0, result);
                return;
            }
            check(ui(() -> surface.getParent()) == ui(() -> web.getParent()), "real native overlay and retained WebView share the production Activity surface");
            check(ui(() -> descendants(surface).stream().anyMatch(v -> v.getClass().getName().equals("org.telegram.ui.Components.ChatActivityEnterTopView"))), "integrated surface instantiates genuine Telegram composer-top source");
            check(ui(() -> ((TextView) requireTag("telegram-title")).getText().toString()).equals("ATLAS"), "snapshot routes to exact selected agent in actual native header");
            check(rowsText().contains(PUBLIC_TEXT) && !rowsText().contains("PRIVATE MUST NEVER"), "real JS projection admits public exact-session text and excludes private rows");
            jsCheck("bridgeFixture().agents.length===6", "synthetic snapshot retains all six agents");
            check(ui(()->requireTag("telegram-audio-player").getVisibility())==View.GONE,"actual app projection opens native chat without an idle audio toolbar");
            jsCheck("JSON.parse(localStorage.getItem('"+CACHE+"')).preferences.automaticSpeech===false", "actual retained app speech preference remains explicit manual-first");
            int originalTextZoom=ui(()->web.getSettings().getTextZoom());
            double originalRootFont=Double.parseDouble(js("parseFloat(getComputedStyle(document.documentElement).fontSize)"));
            click(requireTag("telegram-nav-settings"));waitShowing(false);
            waitJs("!document.getElementById('view-settings').hidden");
            double settingsRootFont=Double.parseDouble(js("parseFloat(getComputedStyle(document.documentElement).fontSize)"));
            int settingsTextZoom=ui(()->web.getSettings().getTextZoom());
            double expectedRootFont=16d*originalTextZoom/100d;
            String fontEvidence="before="+originalRootFont+"px after="+settingsRootFont+"px zoom="+originalTextZoom+"→"+settingsTextZoom+" system="+activity.getResources().getConfiguration().fontScale+" expected="+expectedRootFont+"px";
            android.util.Log.i("DracoTelegramBridge","SETTINGS_TYPOGRAPHY "+fontEvidence);
            jsCheck("JSON.parse(localStorage.getItem('"+CACHE+"')).preferences.scale===100", "opening Settings preserves saved 100 percent app scale");
            check(Math.abs(originalRootFont-expectedRootFont)<.15&&Math.abs(settingsRootFont-expectedRootFont)<.15&&Math.abs(originalRootFont-settingsRootFont)<.1,"native-to-Settings typography applies the 16px base and system zoom exactly once: "+fontEvidence);
            check(settingsTextZoom==originalTextZoom,"Settings navigation does not reapply or multiply native WebView font zoom: "+fontEvidence);
            js("DracoWatch.select('atlas')");waitShowing(true);waitRows(PUBLIC_TEXT);
            check(ui(()->requireTag("telegram-audio-player").getVisibility())==View.GONE,"return from Settings remains silent with no idle player");
            click(requireTag("telegram-options"));dialogChoice("Diagnostics");waitShowing(false);waitJs("document.getElementById('debug-dialog').open");
            jsCheck("JSON.parse(DracoNative.nativeDiagnostics()).schema==='draco.native-diagnostics.v1'", "actual bridge exposes bounded native journal to explicit Debug view");
            check(!field("localWebInspection").getBoolean(activity),"opening Debug view does not silently enable local WebView inspection");
            js("document.getElementById('debug-close').click()");waitShowing(true);

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
            assertLayout("100 percent app scale"); screenshot("integrated-pinned-chat"); assertBoundary("first-page bridge");

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

            click(requireTag("telegram-options")); dialogChoice("Files, drafts and outbox"); waitShowing(false);
            waitJs("!!document.getElementById('native-return')&&!document.getElementById('conversation-screen').hidden");
            jsCheck("!document.querySelector('dialog[open]')&&document.getElementById('draft').value===" + JSONObject.quote(DRAFT), "native Files/drafts/outbox reveals complete retained composer without clearing draft or substituting action modal");
            jsCheck("bridgeChecks.actions.some(e=>e.action==='composer'&&e.data.agent==='atlas'&&e.data.sessionId==='" + SESSION + "')", "complete composer navigation keeps exact native-to-JS conversation scope");
            screenshot("integrated-complete-composer"); js("document.getElementById('native-return').click()"); waitShowing(true);
            check(ui(() -> ((EditText) requireTag("telegram-draft")).getText().toString()).equals(DRAFT), "return from complete composer preserves exact native draft");

            click(requireTag("telegram-options")); dialogChoice("Advanced conversation controls");
            waitJs("document.getElementById('conversation-actions-dialog').open"); waitShowing(false);
            jsCheck("bridgeChecks.actions.some(e=>e.action==='tools'&&e.data.agent==='atlas'&&e.data.sessionId==='" + SESSION + "')", "native advanced-tools action reaches existing exact-scope JS dialog");
            screenshot("integrated-advanced-dialog");
            js("document.getElementById('conversation-actions-close').click()"); waitShowing(true);
            check(ui(() -> ((TextView) requireTag("telegram-title")).getText().toString()).equals("ATLAS"), "closing legacy advanced dialog restores real native conversation");

            js("(()=>{const e=document.getElementById('display-scale');e.value='150';e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
            SystemClock.sleep(180); assertLayout("150 percent app scale"); screenshot("integrated-chat-app150");
            publicProgressCase();
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
