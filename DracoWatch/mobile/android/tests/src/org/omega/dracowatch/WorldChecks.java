package org.omega.dracowatch;

import android.app.*;
import android.content.*;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.os.*;
import android.view.*;
import android.webkit.WebView;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.*;

/** First-person integration only. Mandatory unpaired target; synthetic GET spies,
 * genuine renderTelegram/native actions and actual Android touch/screenshots.
 * This does not replace retained chat/custody suites or physical-phone acceptance. */
public final class WorldChecks extends Instrumentation {
    private Activity activity;private WebView web;private TelegramSurface surface;private Bundle args;private int checks;private String savedCache;
    private static final String CACHE="draco-watch-client-v2";
    private static final class FrameJournal implements Window.OnFrameMetricsAvailableListener {
        private static final long[] BOUNDS={4000000,8000000,12000000,16666667,24000000,33333334,50000000,75000000,100000000,200000000,500000000,Long.MAX_VALUE};
        private final Map<String,long[]> totalHist=new LinkedHashMap<>(),cpuHist=new LinkedHashMap<>();
        private final Map<String,Long> counts=new LinkedHashMap<>();private final JSONArray samples=new JSONArray();
        private String phase="settle";private long callbacks,listenerDropped,overSampleCap;
        synchronized void phase(String next){phase=next;}
        private int bucket(long ns){for(int i=0;i<BOUNDS.length;i++)if(ns<=BOUNDS[i])return i;return BOUNDS.length-1;}
        @Override public synchronized void onFrameMetricsAvailable(Window window,FrameMetrics frame,int dropped){
            // Window TOTAL_DURATION is not presentation/GPU time. The CPU sum
            // below is only named UI/thread phases, not whole-process CPU use.
            long total=Math.max(0,frame.getMetric(FrameMetrics.TOTAL_DURATION)),cpu=0;
            for(int metric:new int[]{FrameMetrics.INPUT_HANDLING_DURATION,FrameMetrics.ANIMATION_DURATION,FrameMetrics.LAYOUT_MEASURE_DURATION,FrameMetrics.DRAW_DURATION,FrameMetrics.SYNC_DURATION,FrameMetrics.COMMAND_ISSUE_DURATION})cpu+=Math.max(0,frame.getMetric(metric));
            if(!totalHist.containsKey(phase)){totalHist.put(phase,new long[BOUNDS.length]);cpuHist.put(phase,new long[BOUNDS.length]);counts.put(phase,0L);}
            totalHist.get(phase)[bucket(total)]++;cpuHist.get(phase)[bucket(cpu)]++;counts.put(phase,counts.get(phase)+1);callbacks++;listenerDropped+=Math.max(0,dropped);
            if(samples.length()<1024)try{samples.put(new JSONObject().put("phase",phase).put("windowTotalNs",total).put("namedCpuPhaseSumNs",cpu));}catch(Exception ignored){}else overSampleCap++;
        }
        synchronized JSONObject snapshot()throws Exception{JSONObject phases=new JSONObject();for(String name:totalHist.keySet())phases.put(name,new JSONObject().put("count",counts.get(name)).put("windowTotalHistogram",new JSONArray(totalHist.get(name))).put("namedCpuPhaseSumHistogram",new JSONArray(cpuHist.get(name))));
            JSONArray bounds=new JSONArray();for(long bound:BOUNDS)bounds.put(bound==Long.MAX_VALUE?"overflow":bound);
            return new JSONObject().put("scope","Isolated emulator Activity Window FrameMetrics; not physical phone FPS, GPU/presentation latency or whole-process CPU").put("bucketUpperBoundsNs",bounds).put("phases",phases).put("observedCallbacks",callbacks).put("listenerReportedDropped",listenerDropped).put("rawSampleCap",1024).put("rawSamplesOmittedAtCap",overSampleCap).put("samples",samples);}
    }
    @Override public void onCreate(Bundle arguments){super.onCreate(arguments);args=arguments==null?new Bundle():arguments;start();}
    private Field field(String name)throws Exception{Field f=activity.getClass().getDeclaredField(name);f.setAccessible(true);return f;}
    private String js(String script)throws Exception{String[] result={null};CountDownLatch done=new CountDownLatch(1);runOnMainSync(()->web.evaluateJavascript(script,value->{result[0]=value;done.countDown();}));if(!done.await(15,TimeUnit.SECONDS))throw new AssertionError("WebView evaluation timed out");return result[0];}
    private void check(boolean condition,String label){if(!condition)throw new AssertionError(label);checks++;android.util.Log.i("DracoWorldCheck","PASS "+label);}
    private void waitJs(String expression)throws Exception{for(int i=0;i<100;i++){if("true".equals(js(expression)))return;SystemClock.sleep(100);}throw new AssertionError("Did not settle: "+expression);}
    private void scriptCheck(String expression,String label)throws Exception{check("true".equals(js(expression)),label);}
    private boolean immersive()throws Exception{return field("worldImmersive").getBoolean(activity);}
    private boolean barsVisible(){boolean[] shown={true};runOnMainSync(()->{if(Build.VERSION.SDK_INT>=30){WindowInsets insets=activity.getWindow().getDecorView().getRootWindowInsets();shown[0]=insets==null||insets.isVisible(WindowInsets.Type.statusBars())||insets.isVisible(WindowInsets.Type.navigationBars());}else{int flags=activity.getWindow().getDecorView().getSystemUiVisibility();shown[0]=(flags&View.SYSTEM_UI_FLAG_FULLSCREEN)==0||(flags&View.SYSTEM_UI_FLAG_HIDE_NAVIGATION)==0;}});return shown[0];}
    private void waitImmersive(boolean expected)throws Exception{for(int i=0;i<80;i++){if(immersive()==expected)return;SystemClock.sleep(100);}throw new AssertionError("Immersive state did not become "+expected);}
    private JSONObject windowGeometry()throws Exception{JSONObject[] result={null};runOnMainSync(()->{try{View decor=activity.getWindow().getDecorView();int[] origin=new int[2];web.getLocationOnScreen(origin);android.widget.FrameLayout.LayoutParams p=(android.widget.FrameLayout.LayoutParams)web.getLayoutParams();JSONObject value=new JSONObject().put("decorWidth",decor.getWidth()).put("decorHeight",decor.getHeight()).put("webWidth",web.getWidth()).put("webHeight",web.getHeight()).put("webX",origin[0]).put("webY",origin[1]).put("margins",new JSONArray(new int[]{p.leftMargin,p.topMargin,p.rightMargin,p.bottomMargin}));if(Build.VERSION.SDK_INT>=30){WindowInsets insets=decor.getRootWindowInsets();if(insets!=null){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()),cutout=insets.getInsets(WindowInsets.Type.displayCutout());value.put("barInsets",new JSONArray(new int[]{bars.left,bars.top,bars.right,bars.bottom})).put("cutoutInsets",new JSONArray(new int[]{cutout.left,cutout.top,cutout.right,cutout.bottom}));}}result[0]=value;}catch(Exception error){throw new AssertionError(error);}});return result[0];}
    // Interact with Android's real first-use education rather than pre-disabling
    // it through secure settings. Never click app or unrecognised system dialogs.
    private void dismissSystemEducation(){
        android.view.accessibility.AccessibilityNodeInfo root=getUiAutomation().getRootInActiveWindow();if(root==null)return;
        CharSequence owner=root.getPackageName();if(owner==null||!("android".contentEquals(owner)||"com.android.systemui".contentEquals(owner)))return;
        for(android.view.accessibility.AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByText("Got it"))
            if(node.isClickable()&&node.isVisibleToUser()&&node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK))android.util.Log.i("DracoWorldCheck","Dismissed actual SystemUI immersive education through accessibility");
    }
    private void waitWorldSettled()throws Exception{String prior="";long stableSince=0;for(int i=0;i<100;i++){dismissSystemEducation();String geometry=windowGeometry().toString();long now=SystemClock.uptimeMillis();if(immersive()&&!barsVisible()&&geometry.equals(prior)){if(stableSince==0)stableSince=now;if(now-stableSince>=900)return;}else stableSince=0;prior=geometry;SystemClock.sleep(100);}throw new AssertionError("Actual hidden bars and world insets did not settle: "+windowGeometry());}
    private void waitSurface(boolean expected)throws Exception{for(int i=0;i<80;i++){boolean[] showing={false};runOnMainSync(()->showing[0]=surface.showing());if(showing[0]==expected)return;SystemClock.sleep(100);}throw new AssertionError("Native surface did not become "+expected);}
    private View tagged(String tag)throws Exception{View[] view={null};runOnMainSync(()->view[0]=surface.findViewWithTag(tag));if(view[0]==null)throw new AssertionError("Missing native control "+tag);return view[0];}
    private void nativeClick(String tag)throws Exception{View view=tagged(tag);runOnMainSync(()->view.performClick());waitForIdleSync();}
    private float[] point(String selector,float x,float y)throws Exception{JSONArray p=new JSONArray(js("(()=>{const r=document.querySelector("+JSONObject.quote(selector)+").getBoundingClientRect();return [r.x+r.width*"+x+",r.y+r.height*"+y+",innerWidth];})()"));int[] origin=new int[2];runOnMainSync(()->web.getLocationOnScreen(origin));float factor=web.getWidth()/(float)p.getDouble(2);return new float[]{origin[0]+(float)p.getDouble(0)*factor,origin[1]+(float)p.getDouble(1)*factor,factor};}
    private void pointer(long start,int action,float x,float y){MotionEvent event=MotionEvent.obtain(start,SystemClock.uptimeMillis(),action,x,y,0);sendPointerSync(event);event.recycle();}
    private void tap(String selector)throws Exception{js("(()=>{const el=document.querySelector("+JSONObject.quote(selector)+");if(!el)throw new Error('Missing tap target');el.scrollIntoView({block:'nearest',inline:'nearest'});return true;})()");SystemClock.sleep(180);float[] p=point(selector,.5f,.5f);long start=SystemClock.uptimeMillis();pointer(start,MotionEvent.ACTION_DOWN,p[0],p[1]);SystemClock.sleep(60);pointer(start,MotionEvent.ACTION_UP,p[0],p[1]);waitForIdleSync();SystemClock.sleep(150);}
    private void drag(String selector,float dx,float dy,long hold)throws Exception{float[] p=point(selector,.5f,.5f);long start=SystemClock.uptimeMillis();pointer(start,MotionEvent.ACTION_DOWN,p[0],p[1]);for(int i=1;i<=5;i++){SystemClock.sleep(35);pointer(start,MotionEvent.ACTION_MOVE,p[0]+dx*p[2]*i/5,p[1]+dy*p[2]*i/5);}SystemClock.sleep(hold);pointer(start,MotionEvent.ACTION_UP,p[0]+dx*p[2],p[1]+dy*p[2]);SystemClock.sleep(120);}
    private void fingers(long start,int action,float[] a,float[] b){
        int count=b==null?1:2;MotionEvent.PointerProperties[] properties=new MotionEvent.PointerProperties[count];MotionEvent.PointerCoords[] coordinates=new MotionEvent.PointerCoords[count];
        for(int i=0;i<count;i++){properties[i]=new MotionEvent.PointerProperties();properties[i].id=i;properties[i].toolType=MotionEvent.TOOL_TYPE_FINGER;coordinates[i]=new MotionEvent.PointerCoords();coordinates[i].x=(i==0?a:b)[0];coordinates[i].y=(i==0?a:b)[1];coordinates[i].pressure=1;coordinates[i].size=1;}
        MotionEvent event=MotionEvent.obtain(start,SystemClock.uptimeMillis(),action,count,properties,coordinates,0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);sendPointerSync(event);event.recycle();
    }
    private void multiTouch(String label)throws Exception{
        JSONObject before=pose();float[] pad=point("#world-walk",.5f,.5f),look=point("#environment-canvas",.62f,.34f);long start=SystemClock.uptimeMillis();
        fingers(start,MotionEvent.ACTION_DOWN,pad,null);SystemClock.sleep(70);fingers(start,MotionEvent.ACTION_POINTER_DOWN|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),pad,look);
        for(int i=1;i<=8;i++){SystemClock.sleep(65);fingers(start,MotionEvent.ACTION_MOVE,new float[]{pad[0],pad[1]-24*pad[2]},new float[]{look[0]-i*7*look[2],look[1]});}
        fingers(start,MotionEvent.ACTION_POINTER_UP|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new float[]{pad[0],pad[1]-24*pad[2]},new float[]{look[0]-56*look[2],look[1]});fingers(start,MotionEvent.ACTION_UP,new float[]{pad[0],pad[1]-24*pad[2]},null);SystemClock.sleep(150);
        JSONObject after=pose();check(distance(before,after)>.1&&Math.abs(before.getDouble("yaw")-after.getDouble("yaw"))>.08,label+" two real simultaneous fingers walk and look independently");
        check(Math.abs(after.getJSONObject("movement").optDouble("x"))+Math.abs(after.getJSONObject("movement").optDouble("z"))<.001,label+" releasing both fingers clears movement");
        start=SystemClock.uptimeMillis();fingers(start,MotionEvent.ACTION_DOWN,pad,null);fingers(start,MotionEvent.ACTION_MOVE,new float[]{pad[0],pad[1]-24*pad[2]},null);SystemClock.sleep(120);fingers(start,MotionEvent.ACTION_CANCEL,new float[]{pad[0],pad[1]-24*pad[2]},null);SystemClock.sleep(100);JSONObject cancelled=pose();
        check(Math.abs(cancelled.getJSONObject("movement").optDouble("x"))+Math.abs(cancelled.getJSONObject("movement").optDouble("z"))<.001,label+" Android touch cancellation stops the player instead of leaving the stick held");
    }
    // Capture the genuine instance on its next normal update and read its existing
    // metadata method. No debugger dialog/bar animations or camera replacement.
    private JSONObject pose()throws Exception{return new JSONObject(js("worldChecks.renderer.diagnostics().player"));}
    private double distance(JSONObject a,JSONObject b)throws Exception{return Math.hypot(a.getDouble("x")-b.getDouble("x"),a.getDouble("z")-b.getDouble("z"));}
    private void installBoundary()throws Exception{
        js("(()=>{const actual=DracoNative;window.worldChecks={calls:[],actions:[],renders:0,last:null,fixtureAt:Date.now()};const update=DracoEnvironment.Environment.prototype.update;DracoEnvironment.Environment.prototype.update=function(...a){worldChecks.renderer=this;return update.apply(this,a);};window.DracoNative={renderTelegram(s){worldChecks.renders++;worldChecks.last=JSON.parse(s);actual.renderTelegram(s);},notifyTelegram(){},refresh(agent){worldChecks.calls.push({method:'REFRESH',agent});setTimeout(()=>onDracoSnapshot(worldFixture(agent)),0);},request(id,method,path,body){worldChecks.calls.push({method,path});const agent=new URL('https://fixture.invalid'+path).searchParams.get('agent')||'atlas';const data=path.startsWith('/v1/capabilities?')?{agent,sessionId:'world-session-'+agent,send:true,queue:true,steer:true,strictSteer:true,abort:true,durableStop:true,attachments:true,voice:true,reply:true,speech:false,commands:[]}:{};setTimeout(()=>onDracoResponse({id,ok:true,status:200,data}),0);},stopMedia(){},hideKeyboard(){actual.hideKeyboard();},setPlaybackRate(){},nativeDiagnostics(){return actual.nativeDiagnostics();},recordDiagnostic(s){actual.recordDiagnostic(s);}};const handler=onDracoTelegramAction;window.onDracoTelegramAction=e=>{worldChecks.actions.push(e);return handler(e);};window.worldFixture=(agent='atlas')=>{const now=Date.now(),ids=['main','forge','atlas','aera-new','vvv','daedalus'];return {connected:true,lastSuccess:now,capturedAt:now,selectedAgent:agent,agents:ids.map(id=>({id,status:'active',conversationStatus:'active',runPhase:{phase:'tool-wait',runId:'world-run-'+id,observedAt:now,expiresAt:now+10000},sessionId:'world-session-'+id,sessionKey:'agent:'+id+':telegram:direct:8745908879',historyAvailable:true,capabilities:{send:true,queue:true,steer:true,strictSteer:true,abort:true,durableStop:true},controlTargets:[{agent:id,sessionId:'world-session-'+id,sessionKey:'agent:'+id+':telegram:direct:8745908879',runId:'world-run-'+id,scope:'conversation'}]})),historyState:{status:'complete'},conversation:[{id:'world-report-'+agent,agent,sessionId:'world-session-'+agent,role:'assistant',text:'WORLD EXACT PUBLIC '+agent,timestamp:worldChecks.fixtureAt-1000,source:'authenticated-native-history',publicAttested:true,media:[]}],fleetActivity:ids.map(id=>({id:'world-public-'+id,agent:id,sessionId:'world-session-'+id,role:'assistant',text:'WORLD PUBLIC FLEET REPORT '+id,timestamp:worldChecks.fixtureAt-1000,source:'authenticated-native-history',publicAttested:true,media:[]})),workActivity:[],fleetCoverage:ids.map(agent=>({agent,available:true}))};};onDracoSnapshot(worldFixture());return true;})()");
    }
    private File artifact(String name)throws Exception{File root=new File(getTargetContext().getExternalFilesDir(null),"world-checks");if(!root.exists()&&!root.mkdirs())throw new IOException("Cannot create world artifact directory");return new File(root,name);}
    private void screenshot(String label)throws Exception{
        JSONObject player=pose();waitWorldSettled();CountDownLatch frame=new CountDownLatch(1);runOnMainSync(()->web.postVisualStateCallback(SystemClock.uptimeMillis(),new WebView.VisualStateCallback(){@Override public void onComplete(long id){frame.countDown();}}));if(!frame.await(8,TimeUnit.SECONDS))throw new AssertionError("World frame not committed");waitWorldSettled();JSONObject nativeWindow=windowGeometry();
        JSONArray margins=nativeWindow.getJSONArray("margins");check(margins.getInt(0)==0&&margins.getInt(1)==0&&margins.getInt(2)==0&&margins.getInt(3)==0,label+" world WebView has zero native bar/cutout margins");
        check(nativeWindow.getInt("webWidth")==nativeWindow.getInt("decorWidth")&&nativeWindow.getInt("webHeight")==nativeWindow.getInt("decorHeight"),label+" actual world WebView fills the full Android decor, not a cutout-reserved viewport");
        Bitmap shot=getUiAutomation().takeScreenshot();if(shot==null)throw new AssertionError("Screenshot unavailable");JSONObject r=new JSONObject(js("(()=>{const r=document.getElementById('environment-canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewport:innerWidth};})()"));int[] origin=new int[2];runOnMainSync(()->web.getLocationOnScreen(origin));float factor=web.getWidth()/(float)r.getDouble("viewport");int nonblack=0,max=0;JSONArray samples=new JSONArray();
        for(int row=1;row<=5;row++)for(int col=1;col<=5;col++){int x=Math.round(origin[0]+((float)r.getDouble("x")+(float)r.getDouble("width")*col/6)*factor),y=Math.round(origin[1]+((float)r.getDouble("y")+(float)r.getDouble("height")*row/6)*factor);int rgb=shot.getPixel(Math.max(0,Math.min(x,shot.getWidth()-1)),Math.max(0,Math.min(y,shot.getHeight()-1))),sum=((rgb>>16)&255)+((rgb>>8)&255)+(rgb&255);if(sum>=9)nonblack++;max=Math.max(max,sum);samples.put(sum);}
        try(FileOutputStream out=new FileOutputStream(artifact(label+".png"))){shot.compress(Bitmap.CompressFormat.PNG,100,out);}shot.recycle();try(FileOutputStream out=new FileOutputStream(artifact(label+".json"))){out.write(new JSONObject().put("canvas",r).put("nativeWindow",nativeWindow).put("pixels",samples).put("nonblack",nonblack).put("max",max).put("player",player).toString(2).getBytes("UTF-8"));}
        check(nonblack>=15&&max>=40,label+" actual Android scene pixels, nonblack="+nonblack+"/25 max="+max);
    }
    private void orientation(boolean landscape)throws Exception{
        runOnMainSync(()->activity.setRequestedOrientation(landscape?ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE:ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));waitJs(landscape?"innerWidth>innerHeight":"innerHeight>innerWidth");SystemClock.sleep(350);waitImmersive(true);waitWorldSettled();
        String label=landscape?"landscape-font150":"portrait-font150";
        scriptCheck("document.body.dataset.view==='environment'&&!document.body.classList.contains('chat-open')&&!worldChecks.last.visible&&worldChecks.last.world",label+" launches the genuine immersive first-person world");
        scriptCheck("worldChecks.renderer.diagnostics().actorGeometry==='retained-solid-3d'&&worldChecks.renderer.diagnostics().localBody==='solid-3d-gloves'",label+" main Android path uses actual solid WebGL bodies and gloves, not compatibility sprites");
        check(!barsVisible(),label+" actual Android status and navigation bars are hidden");
        scriptCheck("(()=>{const r=document.getElementById('environment-canvas').getBoundingClientRect();return r.width>=innerWidth-2&&r.height>=innerHeight-2&&document.documentElement.scrollWidth<=innerWidth+1;})()",label+" canvas owns the viewport without horizontal overflow");
        JSONObject before=pose();drag("#world-walk",0,-25,500);JSONObject after=pose();check(distance(before,after)>.03,label+" real Android joystick gesture changes player position");
        double yaw=after.getDouble("yaw");drag("#environment-canvas",55,0,100);JSONObject looked=pose();check(Math.abs(looked.getDouble("yaw")-yaw)>.03,label+" real Android canvas drag changes first-person yaw");
        multiTouch(label);waitImmersive(true);screenshot(label);
        js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}))");tap(".world-menu-button");waitImmersive(false);scriptCheck("document.getElementById('world-menu').open",label+" world menu is reachable and restores system chrome");
        JSONObject modal=pose();SystemClock.sleep(350);check(distance(modal,pose())<.001,label+" modal world does not drift");
        js("window.dispatchEvent(new KeyboardEvent('keyup',{key:'w',bubbles:true}))");
        tap(".world-agent[data-agent='atlas']");waitImmersive(true);waitJs("document.getElementById('world-talk').textContent.includes('ATLAS')");JSONObject atTalk=pose();tap("#world-talk");waitSurface(true);waitImmersive(false);
        waitJs("worldChecks.last.chat&&worldChecks.last.agent==='atlas'&&worldChecks.last.sessionId==='world-session-atlas'");
        check(tagged("telegram-draft") instanceof EditText,label+" Talk reaches exact-session real native composer");for(String tag:new String[]{"telegram-attach","telegram-mic","telegram-send-mode","telegram-send","telegram-options","telegram-pinned-banner","telegram-voice-controls"})check(tagged(tag)!=null,label+" retains native "+tag);
        JSONObject chatting=pose();check(distance(atTalk,chatting)<.001&&Math.abs(chatting.getJSONObject("movement").optDouble("x"))+Math.abs(chatting.getJSONObject("movement").optDouble("z"))<.001,label+" entering chat stops movement without resetting the player");
        nativeClick("telegram-back");waitSurface(false);waitImmersive(true);JSONObject returned=pose();check(distance(atTalk,returned)<.001&&Math.abs(atTalk.getDouble("yaw")-returned.getDouble("yaw"))<.001,label+" native Back returns to the same world pose");
        tap(".world-menu-button");js("[...document.querySelectorAll('.world-menu-nav button')].find(b=>b.textContent==='Settings').click()");waitJs("document.body.dataset.view==='settings'");waitImmersive(false);check(!immersive(),label+" Settings restores normal Android chrome");
        js("DracoWatch.back()");waitJs("document.body.dataset.view==='environment'");waitImmersive(true);
    }
    private void operations(String label)throws Exception{
        tap(".world-menu-button");tap(".world-agent[data-agent='atlas']");waitImmersive(true);tap("#world-operations-open");waitImmersive(false);
        scriptCheck("document.getElementById('world-operations').open&&document.getElementById('world-operations-title').textContent==='ATLAS'&&document.querySelector('.world-operation-body').textContent.includes('WORLD PUBLIC FLEET REPORT atlas')",label+" Operations shows exact captured public session report");
        scriptCheck("document.querySelector('.world-operation-state').textContent.includes('Waiting for tool')&&worldChecks.renderer.diagnostics().active===false",label+" exact-run fresh tool-wait is distinct from a paused local world");
        scriptCheck("document.querySelector('.world-operation-body').clientHeight>=100",label+" actual inset Android landscape retains at least 100 CSS pixels for reading instead of only a heading");
        waitForIdleSync();SystemClock.sleep(250);
        Bitmap operationShot=getUiAutomation().takeScreenshot();
        if(operationShot==null)throw new AssertionError("Operations screenshot unavailable");
        try(FileOutputStream out=new FileOutputStream(artifact(label+"-operations.png"))){operationShot.compress(Bitmap.CompressFormat.PNG,100,out);}finally{operationShot.recycle();}
        tap(".world-operation-agent[data-agent='forge']");SystemClock.sleep(300);
        scriptCheck("document.getElementById('world-operations').open&&document.getElementById('world-operations-title').textContent==='FORGE'&&!document.querySelector('.world-operation-talk').disabled&&document.querySelector('.world-operation-body').textContent.includes('WORLD PUBLIC FLEET REPORT forge')",label+" switching Operations agent survives asynchronous close event with exact usable owner");
        JSONObject before=pose();tap(".world-operation-talk");waitSurface(true);waitJs("worldChecks.last.agent==='forge'&&worldChecks.last.sessionId==='world-session-forge'");
        nativeClick("telegram-back");waitSurface(false);waitImmersive(true);check(distance(before,pose())<.001,label+" drawer conversation returns to retained position");
    }
    private void phaseFeedWait(long until)throws Exception{while(SystemClock.uptimeMillis()<until){SystemClock.sleep(Math.min(200,Math.max(1,until-SystemClock.uptimeMillis())));}}
    private void sustainedUse(int seconds)throws Exception{
        check(seconds>=120&&seconds<=300,"soak duration explicitly bounded to 120–300 seconds");
        HandlerThread metricThread=new HandlerThread("world-soak-frame-metadata");metricThread.start();FrameJournal journal=new FrameJournal();
        runOnMainSync(()->activity.getWindow().addOnFrameMetricsAvailableListener(journal,new Handler(metricThread.getLooper())));
        JSONObject evidence=new JSONObject();long began=SystemClock.uptimeMillis();
        try{
            // Stable report IDs/text/timestamps; only transport/phase freshness
            // clocks advance. Reduced ambient motion is deliberately enabled.
            js("(()=>{worldChecks.soakPolls=0;worldChecks.soakTimer=setInterval(()=>{worldChecks.soakPolls++;onDracoSnapshot(worldFixture(worldChecks.last?.agent||'atlas'));},200);return true;})()");
            journal.phase("unchanged-feed-reduced-ambient");JSONObject idleBefore=new JSONObject(js("worldChecks.renderer.diagnostics()"));long idleStart=SystemClock.uptimeMillis();phaseFeedWait(idleStart+45000);JSONObject idleAfter=new JSONObject(js("worldChecks.renderer.diagnostics()"));
            evidence.put("unchangedFeed",new JSONObject().put("durationMs",SystemClock.uptimeMillis()-idleStart).put("feedTargetHz",5).put("reducedAmbientMotion",true).put("drawsBefore",idleBefore.optLong("draws")).put("drawsAfter",idleAfter.optLong("draws")).put("drawDelta",idleAfter.optLong("draws")-idleBefore.optLong("draws")).put("poseBefore",idleBefore.optJSONObject("player")).put("poseAfter",idleAfter.optJSONObject("player")));
            check(distance(idleBefore.getJSONObject("player"),idleAfter.getJSONObject("player"))<.001,"45-second repeated feed does not move local player");
            check(idleAfter.optLong("draws")-idleBefore.optLong("draws")<=2,"45-second unchanged feed does not continuously repaint the idle Android room");

            journal.phase("actual-two-finger-movement");JSONObject movementBefore=pose();JSONArray collisionSamples=new JSONArray();boolean clear=true;long moveStart=SystemClock.uptimeMillis(),nextSample=moveStart;
            float[] pad=point("#world-walk",.5f,.5f),look=point("#environment-canvas",.62f,.34f);long pointerStart=SystemClock.uptimeMillis();
            fingers(pointerStart,MotionEvent.ACTION_DOWN,pad,null);fingers(pointerStart,MotionEvent.ACTION_POINTER_DOWN|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),pad,look);
            float[] movedPad=pad,movedLook=look;
            try{while(SystemClock.uptimeMillis()-moveStart<60000){long elapsed=SystemClock.uptimeMillis()-moveStart;double wave=Math.sin(elapsed/1900d);
                movedPad=new float[]{pad[0]+(float)(wave*10*pad[2]),pad[1]-24*pad[2]};movedLook=new float[]{look[0]+(float)(Math.sin(elapsed/3700d)*38*look[2]),look[1]+(float)(Math.sin(elapsed/5100d)*5*look[2])};
                fingers(pointerStart,MotionEvent.ACTION_MOVE,movedPad,movedLook);SystemClock.sleep(50);
                if(SystemClock.uptimeMillis()>=nextSample){JSONObject sample=pose();collisionSamples.put(new JSONObject().put("elapsedMs",elapsed).put("player",sample));clear&="clear".equals(sample.optString("collision"));nextSample+=5000;}
            }}finally{fingers(pointerStart,MotionEvent.ACTION_POINTER_UP|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),movedPad,movedLook);fingers(pointerStart,MotionEvent.ACTION_UP,movedPad,null);}
            SystemClock.sleep(150);JSONObject movementAfter=pose();evidence.put("movement",new JSONObject().put("durationMs",SystemClock.uptimeMillis()-moveStart).put("before",movementBefore).put("after",movementAfter).put("collisionSamples",collisionSamples));
            check(clear,"sustained simultaneous walk/look retains a collision-clear player position at bounded samples");
            check(Math.abs(movementAfter.getJSONObject("movement").optDouble("x"))+Math.abs(movementAfter.getJSONObject("movement").optDouble("z"))<.001,"sustained touch release clears both movement axes");

            journal.phase("all-six-native-conversations");JSONArray interactions=new JSONArray();
            for(String agent:new String[]{"main","forge","atlas","aera-new","vvv","daedalus"}){
                tap(".world-menu-button");tap(".world-agent[data-agent='"+agent+"']");waitImmersive(true);JSONObject before=pose();
                scriptCheck("worldChecks.renderer.interactionTarget()?.agent==="+JSONObject.quote(agent)+"&&worldChecks.renderer.interactionTarget()?.explicit===true","sustained "+agent+" menu selection retains communication ownership after walking behind other creatures");
                tap("#world-talk");waitSurface(true);
                waitJs("worldChecks.last.chat&&worldChecks.last.agent==="+JSONObject.quote(agent)+"&&worldChecks.last.sessionId==="+JSONObject.quote("world-session-"+agent));
                check(tagged("telegram-draft") instanceof EditText&&tagged("telegram-attach")!=null&&tagged("telegram-mic")!=null&&tagged("telegram-pinned-banner")!=null,"sustained "+agent+" opens exact full-feature native conversation");
                nativeClick("telegram-back");waitSurface(false);waitImmersive(true);JSONObject after=pose();check(distance(before,after)<.001&&Math.abs(before.getDouble("yaw")-after.getDouble("yaw"))<.001,"sustained "+agent+" Back retains exact world pose");interactions.put(new JSONObject().put("agent",agent).put("sessionId","world-session-"+agent).put("before",before).put("after",after));
            }
            evidence.put("nativeConversationReturns",interactions);journal.phase("operations-and-menu-reading");operations("sustained");tap("#world-operations-open");waitImmersive(false);
            long readStart=SystemClock.uptimeMillis(),deadline=began+seconds*1000L;phaseFeedWait(Math.max(readStart+3000,deadline-3000));
            scriptCheck("document.getElementById('world-operations').open&&document.querySelector('.world-operation-body').textContent.includes('WORLD PUBLIC FLEET REPORT')","sustained Operations remains readable while synthetic feed continues");
            js("DracoWatch.back()");waitImmersive(true);tap(".world-menu-button");waitImmersive(false);phaseFeedWait(deadline);js("DracoWatch.back()");waitImmersive(true);
            evidence.put("durationMs",SystemClock.uptimeMillis()-began).put("requestedSeconds",seconds).put("syntheticPolls",new JSONArray("["+js("worldChecks.soakPolls")+"]").getInt(0)).put("finalRenderer",new JSONObject(js("worldChecks.renderer.diagnostics()")));
            screenshot("soak-final");
        }finally{try{js("clearInterval(worldChecks.soakTimer);true");}finally{runOnMainSync(()->activity.getWindow().removeOnFrameMetricsAvailableListener(journal));metricThread.quitSafely();metricThread.join(2000);evidence.put("windowFrameMetrics",journal.snapshot()).put("scope","Unpaired isolated emulator with synthetic feed; no phone acceptance, production input, playback, controls or measured phone FPS");try(FileOutputStream out=new FileOutputStream(artifact("soak-summary.json"))){out.write(evidence.toString(2).getBytes("UTF-8"));}}}
    }
    @Override public void onStart(){Bundle result=new Bundle();try{
        activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();check(field("profile").get(activity)==null,"mandatory unpaired APK has no production gateway profile");web=(WebView)field("web").get(activity);surface=(TelegramSurface)field("telegram").get(activity);waitJs("!!window.DracoWatch");
        check(Math.abs(activity.getResources().getConfiguration().fontScale-1.5f)<.02,"actual Android font scale is 150 percent, not simulated in JavaScript");
        savedCache=js("localStorage.getItem('"+CACHE+"')");js("window.worldReloadSentinel=true;localStorage.setItem('"+CACHE+"',JSON.stringify({drafts:{},pins:[],pinHistory:[],outbox:[],preferences:{scale:150,motion:true,rendering:'light',echoToTelegram:false,automaticSpeech:false,playbackRate:1}}))");runOnMainSync(()->web.reload());waitJs("document.readyState==='complete'&&typeof worldReloadSentinel==='undefined'&&!!window.DracoWatch");SystemClock.sleep(200);installBoundary();orientation(false);orientation(true);
        operations("normal");String requested=args.getString("soakSeconds");if(requested!=null)sustainedUse(Integer.parseInt(requested));
        scriptCheck("worldChecks.renders>0&&worldChecks.actions.some(e=>e.action==='closeChat'||e.action==='back')","real Java renderer and native Back action remained integrated");
        scriptCheck("worldChecks.calls.every(c=>c.method==='REFRESH'||c.method==='GET'&&(c.path.startsWith('/v1/capabilities?')||c.path==='/v1/diagnostics')||c.method==='POST'&&c.path==='/v1/diagnostics')","world checks dispatch no message/control POST, history replay, production audio or pairing");check(field("profile").get(activity)==null,"target remains unpaired after both orientations");
        result.putString("stream","World checks passed: "+checks+". Actual Android portrait/landscape, native font150%, synthetic unpaired integrated bridge; not physical-handset acceptance.\n");finish(0,result);
    }catch(Throwable error){android.util.Log.e("DracoWorldCheck","FAIL after "+checks,error);result.putString("stream","World checks failed after "+checks+": "+error+"\n");try{Bitmap image=getUiAutomation().takeScreenshot();if(image!=null){try(FileOutputStream out=new FileOutputStream(artifact("failure-screen.png"))){image.compress(Bitmap.CompressFormat.PNG,100,out);}image.recycle();}}catch(Throwable ignored){}finish(1,result);}
    finally{if(web!=null&&savedCache!=null)try{js("(()=>{const v="+savedCache+";if(v===null)localStorage.removeItem('"+CACHE+"');else localStorage.setItem('"+CACHE+"',v);return true;})()");}catch(Exception ignored){}if(activity!=null)runOnMainSync(()->activity.finish());}}
}
