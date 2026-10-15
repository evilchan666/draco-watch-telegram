package org.omega.dracowatch;

import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
import java.io.*;
import java.lang.reflect.*;
import java.util.concurrent.*;

/** Actual candidate Activity/player plus a separate APK UID; no prompts or voice synthesis. */
public final class AudioPolicyChecks extends Instrumentation {
    private int checks; private Messenger competitor; private Activity activity; private Bundle arguments;
    private final BlockingQueue<Bundle> replies=new LinkedBlockingQueue<>();
    private Messenger receiver;
    @Override public void onCreate(Bundle args){arguments=args==null?new Bundle():args;super.onCreate(args);start();}
    private void check(boolean condition,String label){if(!condition)throw new AssertionError(label);checks++;android.util.Log.i("DracoAudioCheck","PASS "+label);}
    private interface Action{void run()throws Exception;}
    private void main(Action action)throws Exception{Throwable[] failure={null};runOnMainSync(()->{try{action.run();}catch(Throwable error){failure[0]=error;}});if(failure[0]!=null)throw new Exception(failure[0]);}
    private Field field(String name)throws Exception{Field value=activity.getClass().getDeclaredField(name);value.setAccessible(true);return value;}
    private Method method(String name,Class<?>...types)throws Exception{Method value=activity.getClass().getDeclaredMethod(name,types);value.setAccessible(true);return value;}
    private Bundle observe()throws Exception{Message query=Message.obtain(null,1);query.replyTo=receiver;competitor.send(query);Bundle result=replies.poll(3,TimeUnit.SECONDS);if(result==null)throw new Exception("Competing fixture did not reply");return result;}
    private void startClip(File tone,String id)throws Exception{main(()->{method("stopPlayback").invoke(activity);field("playingId").set(activity,id);method("playLocal",File.class,String.class,String.class).invoke(activity,tone,"audio/wav",id);});for(int i=0;i<60;i++){boolean[] ready={false};main(()->{MediaPlayer player=(MediaPlayer)field("player").get(activity);ready[0]=player!=null&&field("playerPrepared").getBoolean(activity)&&player.isPlaying();});if(ready[0])return;Thread.sleep(100);}throw new AssertionError("Candidate player never started");}
    @Override public void onStart(){Bundle result=new Bundle();ServiceConnection binding=null;File tone=null;
        try{
            String expected=arguments.getString("targetVersion","0.3.2-candidate");check(getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(),0).versionName.equals(expected),"installed candidate identity: "+expected);
            main(()->receiver=new Messenger(new Handler(Looper.getMainLooper(),message->{replies.offer(message.getData());return true;})));
            CountDownLatch bound=new CountDownLatch(1);binding=new ServiceConnection(){public void onServiceConnected(ComponentName name,IBinder service){competitor=new Messenger(service);bound.countDown();}public void onServiceDisconnected(ComponentName name){competitor=null;}};
            getTargetContext().bindService(new Intent().setComponent(new ComponentName("org.omega.dracowatch.checks","org.omega.dracowatch.CompetingAudioService")),binding,Context.BIND_AUTO_CREATE);
            check(bound.await(4,TimeUnit.SECONDS),"separate competing app bound");
            getTargetContext().startActivity(new Intent().setComponent(new ComponentName("org.omega.dracowatch.checks","org.omega.dracowatch.CompetingAudioActivity")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Bundle first=null;for(int i=0;i<40;i++){first=observe();if(first.getBoolean("playing"))break;Thread.sleep(100);}
            check(first.getBoolean("playing")&&first.getInt("focusGranted")==AudioManager.AUDIOFOCUS_REQUEST_GRANTED,"competing app starts with granted music focus");
            check(first.getInt("uid")!=android.os.Process.myUid(),"competitor uses independent Android UID");
            activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
            // Confirm there is no live pairing before using any target Activity.
            check(field("profile").get(activity)==null,"candidate is unpaired: cannot contact production gateway or agents");
            tone=CompetingAudioActivity.tone(new File(getTargetContext().getCacheDir(),"draco-audio-policy.wav"),440);
            final File clip=tone;Bundle baseline=observe();int beforeMusic=baseline.getInt("position"),volume=baseline.getInt("volume");
            for(int i=0;i<50&&!field("loaded").getBoolean(activity);i++)Thread.sleep(100);
            check(field("loaded").getBoolean(activity),"bundled UI loaded on actual WebView");
            CountDownLatch scriptDone=new CountDownLatch(1);String[] scriptValue={null};
            main(()->((android.webkit.WebView)field("web").get(activity)).evaluateJavascript("document.getElementById('playback-rate').value='0.75';document.getElementById('playback-rate').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('voice-rate').value",value->{scriptValue[0]=value;scriptDone.countDown();}));
            check(scriptDone.await(3,TimeUnit.SECONDS)&&"\"0.75\"".equals(scriptValue[0]),"actual WebView slower-speed control synchronizes chat UI");
            for(int i=0;i<30&&field("playbackRate").getFloat(activity)!=.75f;i++)Thread.sleep(100);
            check(field("playbackRate").getFloat(activity)==.75f,"actual Javascript bridge applies selected slower native speed");
            startClip(clip,"synthetic-autoplay");check(true,"candidate native audio playback started alongside music");
            for(float rate:new float[]{.5f,.75f,1f,1.25f,1.5f,2f}){
                main(()->method("changePlaybackRate",float.class).invoke(activity,rate));int[] before={0},after={0};float[] actual={0,0};
                main(()->{MediaPlayer player=(MediaPlayer)field("player").get(activity);before[0]=player.getCurrentPosition();actual[0]=player.getPlaybackParams().getSpeed();actual[1]=player.getPlaybackParams().getPitch();});long at=SystemClock.elapsedRealtime();Thread.sleep(1000);
                main(()->after[0]=((MediaPlayer)field("player").get(activity)).getCurrentPosition());double ratio=(after[0]-before[0])/(double)(SystemClock.elapsedRealtime()-at);
                check(Math.abs(actual[0]-rate)<.01&&actual[1]==1f,"platform speed "+rate+" with pitch 1.0");
                check(Math.abs(ratio-rate)<.2,"native position advances at selected rate "+rate+" (observed "+ratio+")");
                check(getTargetContext().getSharedPreferences("draco-audio",Context.MODE_PRIVATE).getFloat("rate",1f)==rate,"native speed preference saved at "+rate);
                Bundle music=observe();check(music.getBoolean("playing")&&music.getInt("focusLosses")==0&&music.getInt("volume")==volume,"competing music continues without focus loss or stream-volume change at "+rate);
            }
            check(observe().getInt("position")>beforeMusic+3000,"independent competing-media position advances continuously");
            main(()->method("pausePlayback",String.class).invoke(activity,"synthetic-autoplay"));
            int[] pausedPosition={0};main(()->pausedPosition[0]=((MediaPlayer)field("player").get(activity)).getCurrentPosition());Thread.sleep(300);
            check(!((MediaPlayer)field("player").get(activity)).isPlaying()&&Math.abs(((MediaPlayer)field("player").get(activity)).getCurrentPosition()-pausedPosition[0])<100,"exact-report Pause holds position without releasing the player");
            main(()->{method("resumePlayback",String.class).invoke(activity,"wrong-id");method("seekPlayback",String.class,long.class).invoke(activity,"wrong-id",100L);});
            check(!((MediaPlayer)field("player").get(activity)).isPlaying()&&Math.abs(((MediaPlayer)field("player").get(activity)).getCurrentPosition()-pausedPosition[0])<100,"stale report IDs cannot resume or seek the current audio");
            main(()->method("seekPlayback",String.class,long.class).invoke(activity,"synthetic-autoplay",2000L));Thread.sleep(250);
            check(!((MediaPlayer)field("player").get(activity)).isPlaying()&&Math.abs(((MediaPlayer)field("player").get(activity)).getCurrentPosition()-2000)<300,"seeking an exact paused report moves position without restarting playback");
            main(()->method("resumePlayback",String.class).invoke(activity,"synthetic-autoplay"));
            check(((MediaPlayer)field("player").get(activity)).isPlaying()&&((MediaPlayer)field("player").get(activity)).getPlaybackParams().getPitch()==1f,"explicit exact-report Resume restores playback with fixed pitch");
            main(()->method("changePlaybackRate",float.class).invoke(activity,3f));check(field("playbackRate").getFloat(activity)==2f,"invalid speed cannot replace the saved valid preference");
            main(()->{((MediaPlayer)field("player").get(activity)).pause();method("changePlaybackRate",float.class).invoke(activity,1.5f);});
            check(!((MediaPlayer)field("player").get(activity)).isPlaying(),"changing speed never restarts a paused or ended player");
            main(()->method("changePlaybackRate",float.class).invoke(activity,2f));
            main(()->method("stopPlayback").invoke(activity));check(field("player").get(activity)==null&&field("playingId").get(activity)==null,"immediate Stop releases exact native player");
            startClip(clip,"synthetic-deliberate-replay");float[] replay={0,0};main(()->{PlaybackParams params=((MediaPlayer)field("player").get(activity)).getPlaybackParams();replay[0]=params.getSpeed();replay[1]=params.getPitch();});check(replay[0]==2f&&replay[1]==1f,"deliberate replay inherits saved speed without regeneration");
            main(()->activity.finish());waitForIdleSync();check(field("player").get(activity)==null,"leaving Activity fences playback");
            activity=startActivitySync(new Intent().setClassName(getTargetContext().getPackageName(),"org.omega.dracowatch.MonitorActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();
            check(field("playbackRate").getFloat(activity)==2f&&field("player").get(activity)==null,"Activity recreation restores speed but never replays audio");
            check(observe().getInt("focusLosses")==0,"other app retains its focus through Stop, replay and recreation");
            result.putString("stream","Audio policy checks passed: "+checks+". Synthetic clips on actual Android players; no agent input, synthesis or production pairing. Physical audibility and output waveform unverified.\n");finish(0,result);
        }catch(Throwable error){result.putString("stream","Audio policy checks failed after "+checks+": "+error+"\n");android.util.Log.e("DracoAudioCheck","FAIL",error);finish(1,result);}
        finally{try{if(activity!=null)main(()->activity.finish());if(competitor!=null)competitor.send(Message.obtain(null,2));if(binding!=null)getTargetContext().unbindService(binding);if(tone!=null)tone.delete();}catch(Exception ignored){}}
    }
}
