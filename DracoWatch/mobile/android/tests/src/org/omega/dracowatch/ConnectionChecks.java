package org.omega.dracowatch;

import android.app.AlertDialog;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import org.json.JSONObject;

/** Offline-only failure semantics and native recovery entry. No paired traffic,
 * submitted input, playback, agent control or automatic pairing changes. */
public final class ConnectionChecks extends Instrumentation {
    private int count;
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    private void check(boolean value,String label){if(!value)throw new AssertionError(label);count++;}
    @Override public void onStart(){Bundle out=new Bundle();MonitorActivity activity=null;try{
        long now=1700000000000L;
        check(MonitorActivity.connectionSummary(null,now,false).contains("pairing is missing or invalid"),"unpaired is not a gateway outage");
        check(MonitorActivity.connectionSummary(null,now,true).contains("No snapshot result"),"missing evidence does not claim connectivity");
        JSONObject observed=new JSONObject();observed.put("phase","start");observed.put("at",now);observed.put("durationMs",0);
        check(MonitorActivity.connectionSummary(observed,now,true).contains("in progress"),"in-flight read not called failed");
        observed.put("phase","success");observed.put("status",200);observed.put("gatewayConnected",true);observed.put("gatewayLastSuccess",now-1000);
        String live=MonitorActivity.connectionSummary(observed,now,true);
        check(live.contains("snapshot reply received (HTTP 200)")&&live.contains("fresh observation"),"phone transport and gateway observation labelled separately");
        check(live.contains("not proof of current phone connectivity"),"retained success not advertised as current connectivity");
        check(MonitorActivity.connectionSummary(observed,now+20000,true).contains("expired"),"retained gateway success expires without a new network call");
        observed.put("gatewayConnected",false);
        String offline=MonitorActivity.connectionSummary(observed,now,true);
        check(offline.contains("reply received")&&offline.contains("agent state is unknown"),"reachable Watch with offline gateway is not phone transport failure");
        observed.put("gatewayConnected",true);observed.put("gatewayLastSuccess",now+60000);
        check(MonitorActivity.connectionSummary(observed,now,true).contains("expired"),"future gateway timestamp cannot establish freshness");
        observed.put("phase","failure");observed.put("status",401);observed.put("durationMs",18001);
        check(MonitorActivity.connectionSummary(observed,now,true).contains("authorization"),"401 authorization failure distinct from timeout");
        check(MonitorActivity.connectionFailureHint(403,"SocketTimeoutException").contains("authorization"),"explicit HTTP authorization outranks exception-class guess");
        observed.put("status",0);observed.put("errorName","SSLHandshakeException");
        String tls=MonitorActivity.connectionSummary(observed,now,true);
        check(tls.contains("secure connection could not be verified")&&tls.contains("checks remain enabled"),"TLS failure does not propose weakened pin or reset");
        check(MonitorActivity.connectionFailureHint(0,"SSLPeerUnverifiedException").contains("secure connection"),"hostname verification rejection remains distinct");
        check(MonitorActivity.connectionFailureHint(0,"SocketTimeoutException").contains("timed out"),"timeout gets specific actionable explanation");
        check(MonitorActivity.connectionFailureHint(0,"UnknownHostException").contains("name could not be resolved"),"DNS failure not mislabeled as authorization");
        check(MonitorActivity.connectionFailureHint(0,"ConnectException").contains("could not be reached"),"unreachable endpoint not mislabeled as gateway state");
        check(MonitorActivity.connectionFailureHint(0,"NoRouteToHostException").contains("could not be reached"),"route failure classified without exposing route");
        check(MonitorActivity.connectionFailureHint(503,"IOException").contains("HTTP 503"),"HTTP service failure distinguished from no response");
        observed.put("errorName","SocketTimeoutException");observed.put("correlationId","fixture-request-060");
        String failure=MonitorActivity.connectionSummary(observed,now+2000,true);
        check(failure.contains("18001 ms")&&failure.contains("2 seconds ago")&&failure.contains("fixture-request-060"),"bounded timing and safe correlation visible locally");
        check(failure.contains("Gateway feed: not established")&&failure.contains("never replayed"),"failed read establishes neither gateway state nor permission to retry a message");
        observed.put("errorName","https://private.invalid/?token=never-export");observed.put("correlationId","raw\nprivate");observed.put("message","never-export");observed.put("url","private.invalid");
        String safe=MonitorActivity.connectionSummary(observed,now,true);
        check(!safe.contains("private.invalid")&&!safe.contains("never-export")&&!safe.contains("raw\nprivate"),"failure display never prints arbitrary exception prose URLs or unsafe correlation");

        // The actual dialog is reachable and useful on an unpaired offline APK.
        // A paired installation is categorically excluded before Activity launch.
        check(DracoClient.loadProfile(getTargetContext())==null,"mandatory unpaired instrumentation target");
        Intent launch=new Intent(getTargetContext(),MonitorActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity=(MonitorActivity)startActivitySync(launch);final MonitorActivity owner=activity;
        java.lang.reflect.Method show=MonitorActivity.class.getDeclaredMethod("showConnectionStatus");show.setAccessible(true);
        runOnMainSync(()->{try{show.invoke(owner);}catch(Exception ex){throw new RuntimeException(ex);}});
        java.lang.reflect.Field panelField=MonitorActivity.class.getDeclaredField("connectionDialog");panelField.setAccessible(true);
        AlertDialog panel=(AlertDialog)panelField.get(activity);
        check(panel!=null&&panel.isShowing(),"native connection panel opens without gateway or loaded WebView");
        check("Check connection".contentEquals(panel.getButton(AlertDialog.BUTTON_POSITIVE).getText()),"explicit snapshot-only retry available");
        check("Export local log".contentEquals(panel.getButton(AlertDialog.BUTTON_NEUTRAL).getText())&&panel.getButton(AlertDialog.BUTTON_NEUTRAL).isEnabled(),"local export available without fetching server diagnostics");
        runOnMainSync(()->{panel.dismiss();owner.finish();});activity=null;
        out.putString("result","PASS "+count+" connection checks; no paired traffic, controls, messages or audio");finish(0,out);
    }catch(Throwable error){if(activity!=null){final MonitorActivity owner=activity;runOnMainSync(owner::finish);}out.putString("error",error.toString());out.putInt("checksPassed",count);finish(1,out);}}
}
