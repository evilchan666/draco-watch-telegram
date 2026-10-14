package org.omega.dracowatch;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

/**
 * Changed native Telegram-derived surface only. The target must be unpaired.
 * A fresh isolated Surface uses synthetic public models and a capturing listener:
 * no gateway request, agent input, audio synthesis/playback or historical replay.
 * Parent records the installed APK hash separately. This is emulator evidence,
 * never physical-handset acceptance.
 */
public final class TelegramSurfaceChecks extends Instrumentation {
    private Activity activity;
    private TelegramSurface surface;
    private Bundle arguments;
    private int checks;
    private final List<JSONObject> actions = new ArrayList<>();
    private static final String[] AGENTS = {"main", "forge", "atlas", "aera-new", "vvv", "daedalus"};
    private static final String[] NAMES = {"Commander", "FORGE", "ATLAS", "Æra", "VVV", "Daedalus"};
    private static final String LONG_TEXT = "COMPLETE PUBLIC REPORT\n" + repeat("Readable full message, not a preview. ", 28) + "\nEXACT_END_MARKER";

    @Override public void onCreate(Bundle args) { super.onCreate(args); arguments = args == null ? new Bundle() : args; start(); }
    private interface UiCall<T> { T run() throws Exception; }
    private <T> T ui(UiCall<T> task) throws Exception {
        if (Looper.myLooper() == Looper.getMainLooper()) return task.run();
        Object[] result = new Object[1]; Throwable[] failure = new Throwable[1];
        runOnMainSync(() -> { try { result[0] = task.run(); } catch (Throwable error) { failure[0] = error; } });
        if (failure[0] != null) throw new AssertionError("UI task failed", failure[0]);
        @SuppressWarnings("unchecked") T value = (T) result[0]; return value;
    }
    private void check(boolean condition, String name) {
        if (!condition) throw new AssertionError(name);
        checks++; android.util.Log.i("DracoTelegramCheck", "PASS " + name);
    }
    private static String repeat(String value, int count) { StringBuilder out = new StringBuilder(); for (int i=0;i<count;i++)out.append(value);return out.toString(); }
    private Field activityField(String name) throws Exception { Field f=activity.getClass().getDeclaredField(name);f.setAccessible(true);return f; }
    private List<View> descendants(View root) {
        List<View> result = new ArrayList<>(); result.add(root);
        if (root instanceof ViewGroup) { ViewGroup group=(ViewGroup)root;for(int i=0;i<group.getChildCount();i++)result.addAll(descendants(group.getChildAt(i))); }
        return result;
    }
    private View tag(String value) throws Exception { return ui(() -> surface.findViewWithTag(value)); }
    private View requireTag(String value) throws Exception { View found=tag(value);if(found==null)throw new AssertionError("Missing native view " + value);return found; }
    private ListView timeline() throws Exception { return (ListView) requireTag("telegram-timeline"); }
    private void click(View view) throws Exception { ui(() -> { check(view.isEnabled(), "native action enabled: " + String.valueOf(view.getTag()));view.performClick();return null; });waitForIdleSync(); }
    private void render(JSONObject model) throws Exception { ui(() -> {surface.render(model);return null;});waitForIdleSync();SystemClock.sleep(90); }
    private JSONObject event(int from, String action) { for(int i=actions.size()-1;i>=from;i--)if(action.equals(actions.get(i).optString("action")))return actions.get(i);return null; }
    private static JSONObject json(Object... pairs) throws Exception { JSONObject value=new JSONObject();for(int i=0;i<pairs.length;i+=2)value.put((String)pairs[i],pairs[i+1]);return value; }
    private JSONObject base(boolean chat, String agent) throws Exception {
        long now=System.currentTimeMillis();JSONArray roster=new JSONArray();
        for(int i=0;i<AGENTS.length;i++)roster.put(json("id",AGENTS[i],"name",NAMES[i],"status",i==2?"Active · observed":"Idle · observed","preview","Public operational report for "+AGENTS[i],"color","#70bfe8"));
        return json("visible",true,"chat",chat,"view","chats","agent",agent,"sessionId","physical-"+agent,"sessionKey","fixture:"+agent,
            "name",name(agent),"status","Observed current run","live",true,"draft","","can",json("send",true,"queue",false,"steer",false,"abort",false,"voice",false,"attachments",true),
            "roster",roster,"messages",new JSONArray().put(json("id","m1","role","assistant","kind","Public report","text",LONG_TEXT,"timestamp",now,"canRead",false,"canPin",true,"canReply",true)).put(json("id","m2","role","user","text","Second readable message","timestamp",now,"canPin",true,"canReply",true)),
            "pins",new JSONArray().put(json("messageId","m1","title","Pinned exact public report","text",LONG_TEXT)).put(json("messageId","not-loaded","title","Older pinned report","text","Older independently retained public report")),
            "pinHistory",new JSONArray().put(json("action","pin","messageId","m1","title","Pinned exact public report","at",now)),
            "playbackRate",.75,"voiceStatus","Ready · synthetic, no audio played","historyNote","Partial public history; no outcome inferred","workSummary","Observed task · tool running","attachments",new JSONArray(),"outbox",new JSONArray());
    }
    private static String name(String id){for(int i=0;i<AGENTS.length;i++)if(AGENTS[i].equals(id))return NAMES[i];return id;}
    private View row(int position) throws Exception {
        ListView list=timeline();return ui(() -> list.getAdapter().getView(position,null,list));
    }
    private TextView exactText(View root,String text) {for(View item:descendants(root))if(item instanceof TextView&&text.equals(((TextView)item).getText().toString()))return (TextView)item;return null;}
    private int classCount(View root,String className){int count=0;for(View v:descendants(root))if(className.equals(v.getClass().getName()))count++;return count;}
    private boolean backgroundClass(View root,String className){for(View v:descendants(root))if(v.getBackground()!=null&&className.equals(v.getBackground().getClass().getName()))return true;return false;}
    private AccessibilityNodeInfo findNode(String text) {
        AccessibilityNodeInfo root=getUiAutomation().getRootInActiveWindow();if(root==null)return null;
        List<AccessibilityNodeInfo> found=root.findAccessibilityNodeInfosByText(text);
        for(AccessibilityNodeInfo node:found)if(node.getText()!=null&&text.equalsIgnoreCase(node.getText().toString()))return node;
        return null;
    }
    private void dialogChoice(String text) throws Exception {
        AccessibilityNodeInfo node=null;
        for(int i=0;i<35&&node==null;i++){node=findNode(text);if(node==null)SystemClock.sleep(80);}
        if(node==null)throw new AssertionError("Dialog choice missing: "+text);
        AccessibilityNodeInfo clickable=node;
        for(int i=0;i<5&&!clickable.isClickable()&&clickable.getParent()!=null;i++)clickable=clickable.getParent();
        check(clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK),"real native dialog action: "+text);
        waitForIdleSync();SystemClock.sleep(80);
    }
    private void openRunOptions() throws Exception { View send=requireTag("telegram-send");ui(()->{check(send.performLongClick(),"native run-control menu opens");return null;});waitForIdleSync(); }
    private boolean exactScope(JSONObject event,String agent) {
        if(event==null)return false;JSONObject data=event.optJSONObject("data");if(data==null)return false;
        return agent.equals(data.optString("agent"))&&("physical-"+agent).equals(data.optString("sessionId"));
    }
    private void assertLayout(String label) throws Exception {
        Rect root=ui(()->{Rect r=new Rect();surface.getGlobalVisibleRect(r);return r;});
        check(root.width()>0&&root.height()>0,label+" native surface has an actual measured viewport");
        for(String id:new String[]{"telegram-navigation","telegram-composer","telegram-send","telegram-draft"}){
            View view=requireTag(id);Rect bounds=ui(()->{Rect r=new Rect();view.getGlobalVisibleRect(r);return r;});
            check(bounds.width()>0&&bounds.height()>0&&bounds.left>=root.left-1&&bounds.right<=root.right+1&&bounds.top>=root.top-1&&bounds.bottom<=root.bottom+1,label+" "+id+" remains visible inside viewport");
        }
        ListView list=timeline();check(ui(()->list.getHeight())>70,label+" retains usable scrollable message space");
        float configured=activity.getResources().getConfiguration().fontScale;
        if(arguments.getBoolean("requireFont150",false))check(configured>=1.49f,"Android native system font is actually enlarged to 150 percent");
    }
    @Override public void onStart() {
        Bundle result=new Bundle();
        try {
            activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
            check(activityField("profile").get(activity)==null,"target APK is unpaired; synthetic test cannot contact production");
            AccessibilityServiceInfo info=getUiAutomation().getServiceInfo();info.flags|=AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;getUiAutomation().setServiceInfo(info);
            ui(()->{surface=new TelegramSurface(activity,(action,data)->{try{actions.add(json("action",action,"data",new JSONObject(data.toString())));}catch(Exception error){throw new AssertionError(error);}});activity.setContentView(surface);return null;});
            render(base(false,"main"));
            check(ui(()->surface.showing()),"actual native Telegram-derived surface is displayed");
            check(ui(()->classCount(surface,"org.telegram.ui.Components.ChatActivityEnterTopView"))==1,"actual upstream composer-top container instantiated");
            check(ui(()->classCount(surface,"org.omega.dracowatch.telegram.PinnedLineView"))==1,"actual upstream multi-pin component instantiated");
            ImageView back=(ImageView)requireTag("telegram-back");check(ui(()->back.getDrawable().getClass().getName()).equals("org.omega.dracowatch.telegram.BackDrawable"),"actual Telegram navigation drawable is in use");
            check(ui(()->timeline().getAdapter().getCount())==6,"native conversation roster contains all six agents");
            for(int i=0;i<AGENTS.length;i++){int from=actions.size();View agentRow=row(i);click(agentRow);JSONObject opened=event(from,"openChat");check(opened!=null&&AGENTS[i].equals(opened.getJSONObject("data").optString("agent")),"native roster navigates exact agent "+AGENTS[i]);}
            render(base(true,"atlas"));View message=row(1);
            check(ui(()->backgroundClass(message,"org.omega.dracowatch.telegram.MessageDrawable")),"message cell uses actual Telegram bubble path renderer");
            TextView full=ui(()->exactText(message,LONG_TEXT));check(full!=null&&ui(()->full.isTextSelectable()),"full exact public message is selectable, not preview-only");
            check(ui(()->full.getEllipsize())==null&&ui(()->full.getMaxLines())>1000,"full report is not visually ellipsized or line-clamped");
            check(ui(()->requireTag("telegram-pinned-banner").getVisibility())==View.VISIBLE,"native pin banner is visible with retained pins");
            int beforeDraft=actions.size();EditText draft=(EditText)requireTag("telegram-draft");ui(()->{draft.requestFocus();draft.setText("EXACT NEW SYNTHETIC DRAFT\nKeep every character.");return null;});
            JSONObject draftEvent=event(beforeDraft,"draft");check(exactScope(draftEvent,"atlas")&&draftEvent.getJSONObject("data").optString("text").equals(draft.getText().toString()),"native draft callback keeps exact text and physical-session scope");
            int beforeSend=actions.size();click(requireTag("telegram-send"));JSONObject sent=event(beforeSend,"send");check(exactScope(sent,"atlas")&&"send".equals(sent.getJSONObject("data").optString("mode")),"native Send stays bound to exact conversation without bypassing custody");
            check(ui(()->draft.getText().toString()).startsWith("EXACT NEW SYNTHETIC"),"native admission does not prematurely clear unsent text");
            int beforeControls=actions.size();openRunOptions();dialogChoice("Steer unavailable · not dispatched");check(event(beforeControls,"send")==null,"unsupported Steer cannot silently queue or send");
            openRunOptions();dialogChoice("Stop unavailable for the observed run");check(event(beforeControls,"stop")==null,"unsupported Stop does not dispatch a session-wide fallback");
            click(requireTag("telegram-pin-options"));dialogChoice("Next pin");
            check(ui(()->{for(View v:descendants(requireTag("telegram-pinned-banner")))if(v instanceof TextView&&((TextView)v).getText().toString().contains("2/2"))return true;return false;}),"native pin navigation cycles its exact retained pin");
            int beforeGoto=actions.size();click(requireTag("telegram-pin-options"));dialogChoice("Open this pin");JSONObject gotoEvent=event(beforeGoto,"goto");check(exactScope(gotoEvent,"atlas")&&"not-loaded".equals(gotoEvent.getJSONObject("data").optString("id")),"unloaded pin navigation preserves exact message/session target");
            click(requireTag("telegram-pin-options"));dialogChoice("Pin history");check(findNode("Pin history · this conversation")!=null,"native pin history dialog is readable");dialogChoice("Close");
            int beforeUnpin=actions.size();click(requireTag("telegram-pin-options"));dialogChoice("Unpin this message");JSONObject unpin=event(beforeUnpin,"unpin");check(exactScope(unpin,"atlas")&&"not-loaded".equals(unpin.getJSONObject("data").optString("id")),"native Unpin targets the selected exact-scope message");
            int beforePin=actions.size();View unpinnedMenu=ui(()->row(2).findViewWithTag("telegram-message-actions-m2"));click(unpinnedMenu);dialogChoice("Pin message");JSONObject pin=event(beforePin,"pin");check(exactScope(pin,"atlas")&&"m2".equals(pin.getJSONObject("data").optString("id")),"native Pin action keeps exact selected message and physical session");
            int beforeReply=actions.size();View replyMenu=ui(()->row(1).findViewWithTag("telegram-message-actions-m1"));click(replyMenu);dialogChoice("Reply");JSONObject replied=event(beforeReply,"reply");check(exactScope(replied,"atlas")&&"m1".equals(replied.getJSONObject("data").optString("id")),"native Reply action preserves original readable message identity");
            // Menu opened under one physical session must not retarget its old ID.
            View menu=ui(()->row(1).findViewWithTag("telegram-message-actions-m1"));click(menu);render(base(true,"forge"));int beforeStale=actions.size();dialogChoice("Unpin");JSONObject stale=event(beforeStale,"unpin");check(stale==null||exactScope(stale,"atlas"),"stale message dialog cannot retarget old message into new agent/session");
            JSONObject activityModel=base(false,"atlas");activityModel.put("view","activity");activityModel.put("activity",new JSONArray().put(json("id","work-1","agent","atlas","name","ATLAS","kind","Tool returned","text","Memory search returned 3 matches","timestamp",System.currentTimeMillis(),"revision","revision-a","detail","Exact owned run: fixture-run\nTool call: fixture-call\nResult: 3 matches; query withheld")));
            render(activityModel);click(requireTag("telegram-expand-work-1"));check(tag("telegram-evidence-work-1")!=null,"native operational event expands supplied same-revision evidence");
            render(new JSONObject(activityModel.toString()));check(tag("telegram-evidence-work-1")!=null,"unchanged native observation retains expanded detail");
            activityModel.getJSONArray("activity").getJSONObject(0).put("revision","revision-b").put("detail","NEW RESULT NOT THE OLD REVISION");render(activityModel);check(tag("telegram-evidence-work-1")==null,"changed observation revision closes evidence instead of silently replacing it");
            JSONObject enlarged=base(true,"atlas");enlarged.put("appScale",1.5);render(enlarged);assertLayout("150 percent app scale");
            check(actions.stream().allMatch(e->!"media".equals(e.optString("action"))&&!"read".equals(e.optString("action"))&&!"stopAudio".equals(e.optString("action"))),"changed surface checks performed no playback, synthesis or agent dispatch");
            result.putString("stream","Telegram surface checks passed: "+checks+". Actual native components/dialogs; isolated synthetic listener, unpaired APK, no production input/audio. Physical acceptance remains unverified.\n");finish(0,result);
        } catch(Throwable error) {result.putString("stream","Telegram surface checks failed after "+checks+": "+error+"\n");android.util.Log.e("DracoTelegramCheck","FAIL",error);finish(1,result);}
        finally {if(activity!=null)runOnMainSync(()->activity.finish());}
    }
}
