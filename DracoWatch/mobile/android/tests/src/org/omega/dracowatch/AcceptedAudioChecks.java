package org.omega.dracowatch;
import android.app.*;
import android.content.*;
import android.media.MediaPlayer;
import android.os.*;
import android.webkit.WebView;
import org.json.JSONObject;
import java.lang.reflect.*;
import java.util.concurrent.*;

/** Exact manual /v1/media download to actual player, isolated synthetic server. */
public final class AcceptedAudioChecks extends Instrumentation {
    private Activity activity;private WebView web;private Bundle args;private int checks;
    @Override public void onCreate(Bundle value){super.onCreate(value);args=value;start();}
    private Field field(String name)throws Exception{Field value=activity.getClass().getDeclaredField(name);value.setAccessible(true);return value;}
    private String evaluate(String script)throws Exception{String[] value={null};CountDownLatch done=new CountDownLatch(1);runOnMainSync(()->web.evaluateJavascript(script,result->{value[0]=result;done.countDown();}));if(!done.await(5,TimeUnit.SECONDS))throw new AssertionError("WebView timeout");return value[0];}
    private void check(boolean value,String label){if(!value)throw new AssertionError(label);checks++;android.util.Log.i("DracoAcceptedAudio","PASS "+label);}
    private boolean script(String value)throws Exception{return "true".equals(evaluate(value));}
    @Override public void onStart(){Bundle result=new Bundle();try{
        check(getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(),0).versionName.equals("0.2.14-candidate"),"exact tested candidate installed");
        activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
        check(field("profile").get(activity)==null,"no production pairing present");
        check("https://127.0.0.1:19816".equals(args.getString("fixtureUrl")),"only isolated reverse-loopback fixture permitted");
        final DracoClient.Profile fixture=new DracoClient.Profile(new JSONObject().put("url",args.getString("fixtureUrl")).put("token",args.getString("fixtureToken")).put("certificateSha256",args.getString("fixturePin")));
        field("profile").set(activity,fixture);web=(WebView)field("web").get(activity);
        for(int i=0;i<100&&!field("loaded").getBoolean(activity);i++)Thread.sleep(100);
        check(field("loaded").getBoolean(activity),"actual bundled WebView loaded");
        for(int i=0;i<100&&!script("!!window.DracoWatch");i++)Thread.sleep(100);
        evaluate("document.getElementById('automatic-speech').checked=false;document.getElementById('automatic-speech').dispatchEvent(new Event('change',{bubbles:true}));DracoWatch.select('forge');DracoNative.refresh('forge');");
        String mediaSelector="#conversation-list [data-message-id$='delivery:9002'] .message-media button";
        for(int i=0;i<100&&!script("!!document.querySelector(\""+mediaSelector+"\")");i++)Thread.sleep(100);
        check(script("!!document.querySelector(\""+mediaSelector+"\")&&!document.querySelector(\""+mediaSelector+"\").disabled"),"accepted source has a usable manual media control");
        check(field("player").get(activity)==null,"history hydration never autoplays attachment");
        check(script("(()=>{document.querySelector('#conversation-list [data-message-id$=\\\"delivery:9002\\\"] .linked-text').click();return document.querySelector('#conversation-list [data-message-id$=\\\"delivery:9002\\\"] details[open]').textContent.includes('Isolated readable report');})()"),"linked independently authored text opens without playback");
        evaluate("document.querySelector(\""+mediaSelector+"\").click()");
        for(int i=0;i<100;i++){MediaPlayer player=(MediaPlayer)field("player").get(activity);if(player!=null&&field("playerPrepared").getBoolean(activity)&&player.isPlaying())break;Thread.sleep(100);}
        MediaPlayer player=(MediaPlayer)field("player").get(activity);
        check(player!=null&&player.isPlaying(),"native authenticated download reaches actual Android playback");
        check(field("playingId").get(activity).toString().endsWith("delivery:9002:0"),"player retains exact selected FORGE message/index identity");
        int before=player.getCurrentPosition();Thread.sleep(700);check(player.getCurrentPosition()>before+200,"actual native playback position advances");
        evaluate("document.querySelector(\""+mediaSelector+"\").click()");
        for(int i=0;i<30&&field("player").get(activity)!=null;i++)Thread.sleep(100);
        check(field("player").get(activity)==null,"same manual control stops exact playback immediately");
        result.putString("stream","Accepted audio checks passed: "+checks+". Real Android authenticated download/player; synthetic source, not handset or historic FORGE replay.\n");finish(0,result);
    }catch(Throwable error){result.putString("stream","Accepted audio checks failed after "+checks+": "+error+"\n");android.util.Log.e("DracoAcceptedAudio","FAIL",error);finish(1,result);}
    finally{if(activity!=null)runOnMainSync(()->activity.finish());}}
}
