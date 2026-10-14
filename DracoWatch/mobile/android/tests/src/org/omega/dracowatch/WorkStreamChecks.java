package org.omega.dracowatch;

import android.app.*;
import android.content.*;
import android.os.*;
import android.webkit.WebView;
import java.lang.reflect.*;
import java.util.concurrent.*;

/** Changed bundled UI only. Synthetic observations, no production profile, input or audio. */
public final class WorkStreamChecks extends Instrumentation {
    private Activity activity; private WebView web; private int checks;
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    private Field field(String name)throws Exception{Field f=activity.getClass().getDeclaredField(name);f.setAccessible(true);return f;}
    private String evaluate(String script)throws Exception{
        String[] value={null};CountDownLatch done=new CountDownLatch(1);
        runOnMainSync(()->web.evaluateJavascript(script,result->{value[0]=result;done.countDown();}));
        if(!done.await(4,TimeUnit.SECONDS))throw new AssertionError("WebView evaluation timed out");return value[0];
    }
    private void check(boolean condition,String label){if(!condition)throw new AssertionError(label);checks++;android.util.Log.i("DracoWorkCheck","PASS "+label);}
    private void scriptCheck(String expression,String label)throws Exception{check("true".equals(evaluate(expression)),label);}
    @Override public void onStart(){Bundle result=new Bundle();try{
        check(getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(),0).versionName.equals("0.2.13-candidate"),"installed changed-UI candidate identity");
        activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
        check(field("profile").get(activity)==null,"unpaired target cannot contact production gateway or agents");
        web=(WebView)field("web").get(activity);
        for(int i=0;i<80&&!field("loaded").getBoolean(activity);i++)Thread.sleep(100);
        check(field("loaded").getBoolean(activity),"changed bundled UI loaded on actual Android WebView");
        for(int i=0;i<80&&!"true".equals(evaluate("!!window.DracoWatch"));i++)Thread.sleep(100);
        scriptCheck("(()=>{window.DracoNative={refresh(){},request(){}};window.workFixture=()=>{const ids=['main','forge','atlas','aera-new','vvv','daedalus'];return {version:2,connected:true,lastSuccess:Date.now(),selectedAgent:'atlas',agents:ids.map(id=>({id,status:'active',sessionId:'session:'+id,sessionKey:'fixture:'+id,capabilities:{}})),conversation:[],historyState:{status:'complete'},fleetCoverage:ids.map(agent=>({agent,available:true,status:'recorded-window',work:{available:true,partial:true}})),fleetActivity:ids.map(agent=>({id:'public-'+agent,agent,sessionId:'session:'+agent,role:'assistant',text:'READABLE PUBLIC '+agent,timestamp:Date.now()-1000})),workActivity:[{id:'memory-result',agent:'atlas',sessionId:'session:atlas',runId:'run:atlas',callId:'memory-call',role:'assistant',kind:'Tool finished',text:'Searching retained memory · returned · 3 memory matches · 2 sources',timestamp:Date.now(),source:'authenticated-tool-status',publicAttested:true,observation:{version:1,agent:'atlas',sessionId:'session:atlas',runId:'run:atlas',callId:'memory-call',tool:'memory_search',phase:'result',redacted:true,result:{matchCount:3,sourceCount:2,sourceKinds:['workspace-memory','retained-session']},gaps:['arguments-withheld']}}]};};onDracoSnapshot(workFixture());DracoWatch.view('activity');return document.getElementById('activity-live').getAttribute('aria-pressed')==='true';})()","default Live feed retains all-six synthetic observations");
        scriptCheck("document.querySelector('#activity-list .timeline-item').textContent.includes('READABLE PUBLIC') && document.querySelector('.tool-status .operation-label').textContent.includes('memory_search')","public report stays first while rich execution appears in Live feed");
        scriptCheck("document.querySelector('#activity-list .timeline-item').getBoundingClientRect().top < document.querySelector('.bottom-nav').getBoundingClientRect().top && document.documentElement.scrollWidth<=innerWidth+1","enlarged Android text preserves first-report visibility without horizontal overflow");
        scriptCheck("(()=>{document.querySelector('.tool-status .activity-expand').click();const text=document.querySelector('.operation-facts').textContent;return text.includes('memory-call')&&text.includes('run:atlas')&&text.includes('Sessionsession:atlas')&&text.includes('Memory matches3')&&text.includes('Retained sources2');})()","expand shows exact agent/session/run/call and bounded memory facts");
        scriptCheck("document.getElementById('activity-observation-note').textContent.includes('Partial execution window')&&document.querySelector('.operation-facts').textContent.includes('search queries withheld')","partial coverage and redaction gaps are explicit");
        scriptCheck("(()=>{const x=workFixture();x.workActivity.push({...x.workActivity[0],id:'wrong-run',text:'PRIVATE MISMATCH',observation:{...x.workActivity[0].observation,runId:'different'}});onDracoSnapshot(x);return !document.getElementById('view-activity').textContent.includes('PRIVATE MISMATCH')&&document.querySelectorAll('.tool-status').length===1&&document.querySelector('.operation-facts').textContent.includes('memory-call');})()","wrong-run detail is rejected and matching disclosure survives refresh");
        scriptCheck("(()=>{document.getElementById('activity-work').click();return document.querySelectorAll('.work-card').length===6&&document.querySelector('.work-card[data-agent=atlas]').textContent.includes('Observed window: 1 calls');})()","six Work summaries include observed call counts");
        scriptCheck("(()=>{DracoWatch.select('atlas');return !document.getElementById('conversation-list').textContent.includes('memory matches');})()","tool evidence does not enter chat text or its speech source");
        scriptCheck("(()=>{DracoWatch.close();DracoWatch.view('activity');onDracoConnection({state:'offline'});return !document.querySelector('.tool-status')&&document.querySelectorAll('#activity-list .timeline-item').length===6&&document.getElementById('activity-freshness').textContent.includes('Offline')&&document.querySelector('.timeline-stale').textContent.includes('not live');})()","offline mode withholds execution but retains separately-labelled received public reports");
        result.putString("stream","Work stream checks passed: "+checks+". Actual Android WebView, synthetic unpaired observations; no agent input/audio or handset acceptance.\n");finish(0,result);
    }catch(Throwable error){result.putString("stream","Work stream checks failed after "+checks+": "+error+"\n");android.util.Log.e("DracoWorkCheck","FAIL",error);finish(1,result);}
    finally{if(activity!=null)runOnMainSync(()->activity.finish());}}
}
