package org.omega.dracowatch;

import android.app.*;
import android.content.*;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.os.*;
import android.view.MotionEvent;
import android.webkit.WebView;
import org.json.*;
import java.io.*;
import java.lang.reflect.*;
import java.util.concurrent.*;

/** Changed viewport/evidence paths only. An unpaired target and synthetic observations.
 * Native font size is set by the external Android test harness, not faked in JS. */
public final class ViewportEvidenceChecks extends Instrumentation {
    private Activity activity; private WebView web; private Bundle arguments;
    private int checks; private boolean baseline; private final JSONArray geometries=new JSONArray();
    private final String[] agents={"main","forge","atlas","aera-new","vvv","daedalus"};
    private final String[] names={"Commander","FORGE","ATLAS","Æra","VVV","Daedalus"};
    @Override public void onCreate(Bundle args){super.onCreate(args);arguments=args==null?new Bundle():args;start();}
    private Field field(String name)throws Exception{Field f=activity.getClass().getDeclaredField(name);f.setAccessible(true);return f;}
    private String evaluate(String script)throws Exception{
        String[] value={null};CountDownLatch done=new CountDownLatch(1);
        runOnMainSync(()->web.evaluateJavascript(script,result->{value[0]=result;done.countDown();}));
        if(!done.await(5,TimeUnit.SECONDS))throw new AssertionError("WebView evaluation timed out");return value[0];
    }
    private void check(boolean condition,String label){if(!condition)throw new AssertionError(label);checks++;android.util.Log.i("DracoViewportCheck","PASS "+label);}
    private void scriptCheck(String expression,String label)throws Exception{check("true".equals(evaluate(expression)),label);}
    private int nativeTextZoom(){final int[] zoom={0};runOnMainSync(()->zoom[0]=web.getSettings().getTextZoom());return zoom[0];}
    private void waitScript(String expression)throws Exception{for(int i=0;i<100;i++){if("true".equals(evaluate(expression)))return;Thread.sleep(100);}throw new AssertionError("Window did not settle: "+expression);}
    private void visualFrame()throws Exception{CountDownLatch drawn=new CountDownLatch(1);runOnMainSync(()->web.postVisualStateCallback(SystemClock.uptimeMillis(),new WebView.VisualStateCallback(){@Override public void onComplete(long requestId){drawn.countDown();}}));if(!drawn.await(10,TimeUnit.SECONDS))throw new AssertionError("WebView did not commit the measured frame");Thread.sleep(150);}
    private File artifact(String name)throws Exception{File root=new File(getTargetContext().getExternalFilesDir(null),"viewport-checks");if(!root.exists()&&!root.mkdirs())throw new IOException("Unable to create artifact directory");return new File(root,name);}
    private void saveScreenshot(String name)throws Exception{visualFrame();Bitmap image=getUiAutomation().takeScreenshot();if(image==null)throw new AssertionError("Android screenshot unavailable");try(FileOutputStream out=new FileOutputStream(artifact(name+".png"))){image.compress(Bitmap.CompressFormat.PNG,100,out);}image.recycle();}
    private void saveGeometry(float nativeScale)throws Exception{try(FileOutputStream out=new FileOutputStream(artifact((baseline?"baseline":"candidate")+"-native"+Math.round(nativeScale*100)+"-geometry.json"))){out.write(geometries.toString(2).getBytes("UTF-8"));}}
    private void touchSelector(String selector)throws Exception{
        evaluate("(()=>{const e=document.querySelector("+JSONObject.quote(selector)+");e.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});return true;})()");Thread.sleep(150);
        visualFrame();
        JSONArray xy=new JSONArray(evaluate("(()=>{const r=document.querySelector("+JSONObject.quote(selector)+").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth];})()"));
        int[] location=new int[2];runOnMainSync(()->web.getLocationOnScreen(location));float ratio=web.getWidth()/(float)xy.getDouble(2);
        float x=location[0]+(float)xy.getDouble(0)*ratio,y=location[1]+(float)xy.getDouble(1)*ratio;
        long now=SystemClock.uptimeMillis();MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+60,MotionEvent.ACTION_UP,x,y,0);
        sendPointerSync(down);sendPointerSync(up);down.recycle();up.recycle();waitForIdleSync();Thread.sleep(120);
    }
    private void setupFixture()throws Exception{
        evaluate("(()=>{window.viewportCalls=[];window.DracoNative={refresh(){},request(id,method,path){viewportCalls.push({method,path});},stopMedia(){}};window.viewportFixture=()=>{const ids=['main','forge','atlas','aera-new','vvv','daedalus'],now=Date.now();return {version:2,connected:true,lastSuccess:now,selectedAgent:'atlas',agents:ids.map(id=>({id,status:id==='atlas'?'active':'idle',sessionId:'session:'+id,sessionKey:'fixture:'+id,capabilities:{}})),conversation:[],historyState:{status:'complete'},fleetCoverage:ids.map(agent=>({agent,available:true,status:'recorded-window',work:{available:true,partial:true}})),fleetActivity:ids.map(agent=>({id:'public-'+agent,agent,sessionId:'session:'+agent,role:'assistant',text:'READABLE PUBLIC '+agent+' report with enough words to occupy more than a tiny truncated chip.',timestamp:now-1000})),workActivity:[]};};onDracoSnapshot(viewportFixture());DracoWatch.view('settings');document.getElementById('automatic-speech').checked=false;document.getElementById('automatic-speech').dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
    }
    private void viewportCase(boolean landscape,int scale,float nativeScale)throws Exception{
        runOnMainSync(()->activity.setRequestedOrientation(landscape?ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE:ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        waitScript(landscape?"innerWidth>innerHeight":"innerHeight>innerWidth");Thread.sleep(200);
        evaluate("(()=>{DracoWatch.close();onDracoSnapshot(viewportFixture());DracoWatch.view('settings');const e=document.getElementById('display-scale');e.value='"+scale+"';e.dispatchEvent(new Event('input',{bubbles:true}));DracoWatch.view('environment');document.getElementById('environment-fit').click();return true;})()");
        Thread.sleep(400);
        String label=(baseline?"baseline":"candidate")+"-"+(landscape?"landscape":"portrait")+"-native"+Math.round(nativeScale*100)+"-app"+scale;
        JSONObject geometry=new JSONObject(evaluate("(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollX,scrollY,visualHeight:visualViewport?.height},stage:rect('#environment-stage'),canvas:rect('#environment-canvas'),toolbar:rect('.environment-toolbar'),stations:rect('#environment-stations'),note:rect('.environment-note'),nav:rect('.bottom-nav'),nativeFont:getComputedStyle(document.documentElement).getPropertyValue('--native-font-scale'),appScale:getComputedStyle(document.documentElement).getPropertyValue('--display-scale'),scrollWidth:document.documentElement.scrollWidth,buttonCount:document.querySelectorAll('.environment-agent').length};})()"));
        geometry.put("case",label);geometry.put("nativeFontScale",nativeScale);geometry.put("nativeTextZoom",nativeTextZoom());geometries.put(geometry);saveGeometry(nativeScale);saveScreenshot(label);android.util.Log.i("DracoViewportCheck","GEOMETRY "+geometry);
        check(nativeTextZoom()==Math.round(nativeScale*100),label+" uses Android native font scale");
        check(geometry.getInt("buttonCount")==6,label+" has six agent selectors");
        if(!baseline){
            scriptCheck("document.documentElement.scrollWidth<=innerWidth+1",label+" has no horizontal page overflow");
            scriptCheck("(()=>{const t=document.querySelector('.environment-toolbar').getBoundingClientRect(),s=document.getElementById('environment-stations').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return t.bottom<=n.top+1&&s.bottom<=n.top+1&&t.top>=0;})()",label+" camera and station controls stay above fixed navigation");
            scriptCheck("(()=>{const c=document.getElementById('environment-canvas').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return c.width>100&&c.height>=72&&c.top>=0&&c.bottom<n.top;})()",label+" spatial viewport uses available screen, not a growing minimum");
            for(int i=0;i<agents.length;i++){
                evaluate("onDracoSnapshot(viewportFixture())");touchSelector(".environment-agent[data-agent='"+agents[i]+"']");
                scriptCheck("!document.getElementById('conversation-screen').hidden&&document.getElementById('conversation-name').textContent==="+JSONObject.quote(names[i]),label+" native tap selects "+names[i]+" correctly");
                evaluate("DracoWatch.close();DracoWatch.view('environment');document.getElementById('environment-fit').click()");Thread.sleep(70);
            }
        }
    }
    private void richEvidenceCase(float nativeScale)throws Exception{
        runOnMainSync(()->activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));waitScript("innerHeight>innerWidth");
        evaluate("(()=>{DracoWatch.close();DracoWatch.view('settings');const e=document.getElementById('display-scale');e.value='100';e.dispatchEvent(new Event('input',{bubbles:true}));window.richFixture=()=>{const x=viewportFixture(),now=Date.now(),source={kind:'recorded-history',sequence:5,projectionRevision:3,observedAt:now,freshUntil:now+15000};x.workActivity=[{id:'memory-result',agent:'atlas',sessionId:'session:atlas',sessionKey:'fixture:atlas',runId:'run:atlas',callId:'memory-call',role:'assistant',kind:'Tool finished',text:'Searching retained memory · returned · 3 memory matches · 2 sources',timestamp:now,source:'authenticated-tool-status',publicAttested:true,evidenceRevision:'1'.repeat(64),evidenceSource:source,observation:{version:1,agent:'atlas',sessionId:'session:atlas',sessionKey:'fixture:atlas',runId:'run:atlas',callId:'memory-call',tool:'memory_search',toolName:'mcp__memory__memory_search',phase:'result',redacted:true,operation:'Search retained memory. Raw query withheld.',result:{matchCount:3,sourceCount:2,sourceKinds:['workspace-memory','retained-session'],corpusKinds:['workspace-memory'],stale:true,partial:true,disabled:true},gaps:['arguments-withheld']}},{id:'process-result',agent:'atlas',sessionId:'session:atlas',sessionKey:'fixture:atlas',runId:'run:atlas',callId:'process-call',role:'assistant',kind:'Tool finished',text:'Executing command · returned · exit 0',timestamp:now-1,source:'authenticated-tool-status',publicAttested:true,evidenceRevision:'2'.repeat(64),evidenceSource:source,observation:{version:1,agent:'atlas',sessionId:'session:atlas',sessionKey:'fixture:atlas',runId:'run:atlas',callId:'process-call',tool:'exec_command',toolName:'mcp__runtime__gateway_exec',phase:'result',redacted:true,operation:'node test mobile/tests/viewport-check.mjs',command:{program:'node',operation:'test',flags:['--test'],targets:['mobile/tests/viewport-check.mjs']},result:{exitCode:0,outputLines:4,outputBytes:120,processId:'417',durationMs:250,truncated:true},gaps:[]}}];return x;};onDracoSnapshot(richFixture());DracoWatch.view('activity');return true;})()");
        scriptCheck("document.querySelector('#activity-list .timeline-item').textContent.includes('READABLE PUBLIC')","rich tool stream keeps the newest public report prominent");
        scriptCheck("document.querySelectorAll('.tool-status').length===2&&document.getElementById('activity-list').textContent.includes('mcp__memory__memory_search')&&document.getElementById('activity-list').textContent.includes('mcp__runtime__gateway_exec')","actual original namespaced tools remain visible rather than category-only labels");
        evaluate("(()=>{for(const e of document.querySelectorAll('.tool-status .activity-expand'))e.click();return true;})()");
        scriptCheck("(()=>{const t=document.querySelector('#activity-list [data-message-id=memory-result]').textContent;return t.includes('fixture:atlas')&&t.includes('session:atlas')&&t.includes('run:atlas')&&t.includes('memory-call')&&t.includes('3')&&t.includes('2')&&/stale/i.test(t)&&/partial/i.test(t)&&/disabled/i.test(t);})()","expanded memory evidence shows owner tuple, counts and explicit supplied warnings");
        scriptCheck("(()=>{const t=document.querySelector('#activity-list [data-message-id=process-result]').textContent;return t.includes('417')&&t.includes('250')&&t.includes('recorded-history')&&t.includes('node')&&t.includes('viewport-check.mjs')&&/truncat/i.test(t);})()","expanded command evidence preserves revision/source, process, duration and truncation");
        saveScreenshot("candidate-rich-detail-native"+Math.round(nativeScale*100));
        scriptCheck("(()=>{onDracoSnapshot(richFixture());return document.querySelector('#activity-list [data-message-id=memory-result] .operation-facts')!==null;})()","same evidence revision retains the read-only expanded view");
        scriptCheck("(()=>{const x=richFixture();x.workActivity[0].evidenceRevision='3'.repeat(64);x.workActivity[0].observation.result.matchCount=4;onDracoSnapshot(x);return !document.querySelector('#activity-list [data-message-id=memory-result] .operation-facts');})()","changed evidence revision closes expansion instead of silently replacing evidence");
        scriptCheck("(()=>{const x=richFixture();x.workActivity[0].observation.sessionKey='fixture:wrong';onDracoSnapshot(x);return !document.querySelector('#activity-list [data-message-id=memory-result]');})()","same-session wrong sessionKey evidence is rejected");
        scriptCheck("!document.getElementById('conversation-list').textContent.includes('memory matches')","raw execution details are not inserted into chat or speech");
        scriptCheck("viewportCalls.every(call=>call.method==='GET'&&call.path.startsWith('/v1/capabilities'))","evidence expansion is read-only without added native calls");
    }
    @Override public void onStart(){Bundle result=new Bundle();try{
        baseline="true".equals(arguments.getString("baseline"));
        String expected=arguments.getString("version",baseline?"0.2.14-candidate":"0.2.15-candidate");
        check(getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(),0).versionName.equals(expected),"installed target version is "+expected);
        activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
        check(field("profile").get(activity)==null,"unpaired target cannot contact production gateway or agents");web=(WebView)field("web").get(activity);
        for(int i=0;i<80&&!field("loaded").getBoolean(activity);i++)Thread.sleep(100);
        check(field("loaded").getBoolean(activity),"bundled candidate assets loaded in Android WebView");waitScript("!!window.DracoWatch");
        float nativeScale=activity.getResources().getConfiguration().fontScale;
        check(Math.abs(nativeScale-Float.parseFloat(arguments.getString("nativeFont","1")))<.02,"actual Android configuration agrees with harness font size");
        setupFixture();viewportCase(false,100,nativeScale);viewportCase(false,150,nativeScale);viewportCase(true,100,nativeScale);viewportCase(true,150,nativeScale);
        if(!baseline)richEvidenceCase(nativeScale);
        scriptCheck("viewportCalls.every(call=>call.method==='GET'&&call.path.startsWith('/v1/capabilities'))","changed viewport checks perform no input, history scans, audio generation or playback");
        saveGeometry(nativeScale);
        result.putString("stream","Viewport checks passed: "+checks+". Native S25-sized Android WebView, font "+nativeScale+", four orientation/app-scale combinations; synthetic unpaired evidence, not physical-handset acceptance.\n");finish(0,result);
    }catch(Throwable error){result.putString("stream","Viewport checks failed after "+checks+": "+error+"\n");android.util.Log.e("DracoViewportCheck","FAIL",error);try{saveScreenshot("failed-after-"+checks);}catch(Exception ignored){}finish(1,result);}
    finally{if(activity!=null)runOnMainSync(()->activity.finish());}}
}
