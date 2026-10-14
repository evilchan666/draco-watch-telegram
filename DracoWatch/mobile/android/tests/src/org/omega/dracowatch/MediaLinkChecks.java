package org.omega.dracowatch;

import android.app.*;
import android.content.*;
import android.os.*;
import android.webkit.WebView;
import java.lang.reflect.*;
import java.util.concurrent.*;

/** Changed attachment/text UI only. Unpaired synthetic history; no audio replay. */
public final class MediaLinkChecks extends Instrumentation {
    private Activity activity; private WebView web; private int checks;
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    private Field field(String name)throws Exception{Field value=activity.getClass().getDeclaredField(name);value.setAccessible(true);return value;}
    private String evaluate(String script)throws Exception{
        String[] value={null};CountDownLatch done=new CountDownLatch(1);
        runOnMainSync(()->web.evaluateJavascript(script,result->{value[0]=result;done.countDown();}));
        if(!done.await(5,TimeUnit.SECONDS))throw new AssertionError("WebView timed out");return value[0];
    }
    private void check(boolean condition,String label){if(!condition)throw new AssertionError(label);checks++;android.util.Log.i("DracoMediaCheck","PASS "+label);}
    private void scriptCheck(String expression,String label)throws Exception{check("true".equals(evaluate(expression)),label);}
    @Override public void onStart(){Bundle result=new Bundle();try{
        check(getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(),0).versionName.equals("0.2.14-candidate"),"installed changed candidate identity");
        activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
        check(field("profile").get(activity)==null,"unpaired target cannot contact production");web=(WebView)field("web").get(activity);
        for(int i=0;i<80&&!field("loaded").getBoolean(activity);i++)Thread.sleep(100);
        check(field("loaded").getBoolean(activity),"bundled UI loaded in Android WebView");
        for(int i=0;i<80&&!"true".equals(evaluate("!!window.DracoWatch"));i++)Thread.sleep(100);
        scriptCheck("(()=>{window.mediaCalls=[];window.DracoNative={refresh(){},request(id,method,path){mediaCalls.push({method,path});},playMedia(){mediaCalls.push({play:true});},stopMedia(){}};window.mediaFixture=()=>{const agent='forge',sessionId='session:forge',now=Date.now();const text={id:'text',agent,sessionId,role:'assistant',kind:'Confirmed report',text:'ACTUAL ANDROID READABLE '+('body '.repeat(100)),timestamp:now-1000,delivery:{state:'delivered',platformMessageId:'2463'}};const audio={id:'voice',agent,sessionId,role:'assistant',kind:'Attachment only',text:'',timestamp:now,delivery:{state:'delivered',platformMessageId:'2465'},replyLink:{status:'available',messageId:'text',platformMessageId:'2463'},media:[{kind:'audio',label:'Voice report',downloadAvailable:false,unavailableReason:'No public managed media byte reference is available'}]};return {connected:true,lastSuccess:now,selectedAgent:agent,agents:['main','forge','atlas','aera-new','vvv','daedalus'].map(id=>({id,status:'idle',sessionId:'session:'+id,historyAvailable:true,capabilities:{}})),conversation:[{...text,kind:'reply'},{...audio,kind:'media'}],historyState:{status:'complete'},fleetActivity:[text,audio],fleetCoverage:[{agent,available:true}]};};onDracoSnapshot(mediaFixture());DracoWatch.view('activity');return document.querySelector('#activity-list [data-message-id=voice]').textContent.includes('Audio unavailable in app');})()","empty attachment is labelled unavailable, not a substantive report");
        scriptCheck("(()=>{document.querySelector('#activity-list [data-message-id=voice] .linked-text').click();return document.querySelector('#activity-list [data-message-id=voice] details[open]').textContent.includes('ACTUAL ANDROID READABLE');})()","linked readable text opens in Activity");
        scriptCheck("(()=>{DracoWatch.select('forge');return document.querySelector('#conversation-list [data-message-id=voice]').textContent.includes('No readable reply text accompanied')&&!document.querySelector('#conversation-list [data-message-id=voice] .message-read-aloud');})()","Chat preserves missing-text state without phantom speech");
        scriptCheck("(()=>{document.querySelector('#conversation-list [data-message-id=voice] .linked-text').click();return document.querySelector('#conversation-list [data-message-id=voice] details[open]').textContent.includes('ACTUAL ANDROID READABLE');})()","Chat opens linked public text without navigation or replay");
        scriptCheck("(()=>{const snapshot=mediaFixture();snapshot.conversation=snapshot.conversation.filter(row=>row.id!=='text');onDracoSnapshot(snapshot);return !document.querySelector('#conversation-list .linked-text');})()","source withdrawal revokes the link");
        scriptCheck("(()=>{onDracoSnapshot(mediaFixture());DracoWatch.close();DracoWatch.view('settings');document.getElementById('display-scale').value='150';document.getElementById('display-scale').dispatchEvent(new Event('input',{bubbles:true}));DracoWatch.view('activity');return document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#activity-list .linked-text').getBoundingClientRect().height>=44;})()","enlarged Android text has reachable link without horizontal overflow");
        scriptCheck("(()=>{onDracoConnection({state:'offline'});return document.querySelector('#activity-list [data-message-id=voice]').textContent.includes('not live');})()","disconnection retains honest last-received status");
        scriptCheck("mediaCalls.every(call=>call.method==='GET'&&call.path.startsWith('/v1/capabilities'))","no history scan, audio playback, synthesis or input dispatch");
        result.putString("stream","Media link checks passed: "+checks+". Actual Android WebView; unpaired synthetic evidence, not handset playback.\n");finish(0,result);
    }catch(Throwable error){result.putString("stream","Media link checks failed after "+checks+": "+error+"\n");android.util.Log.e("DracoMediaCheck","FAIL",error);finish(1,result);}
    finally{if(activity!=null)runOnMainSync(()->activity.finish());}}
}
