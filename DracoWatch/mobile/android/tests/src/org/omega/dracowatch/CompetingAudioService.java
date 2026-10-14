package org.omega.dracowatch;
import android.app.Service;
import android.content.Intent;
import android.media.AudioManager;
import android.os.*;

/** Test-only cross-UID observation; not packaged in DRACO Watch. */
public final class CompetingAudioService extends Service {
    private final Messenger inbox=new Messenger(new Handler(Looper.getMainLooper(),message->{
        if(message.what==2)CompetingAudioActivity.stop();
        Bundle data=new Bundle();data.putInt("uid",android.os.Process.myUid());data.putInt("focusLosses",CompetingAudioActivity.focusLosses);data.putInt("focusGranted",CompetingAudioActivity.focusGranted);data.putString("error",CompetingAudioActivity.error);
        try{if(CompetingAudioActivity.music!=null){data.putBoolean("playing",CompetingAudioActivity.music.isPlaying());data.putInt("position",CompetingAudioActivity.music.getCurrentPosition());}if(CompetingAudioActivity.audio!=null)data.putInt("volume",CompetingAudioActivity.audio.getStreamVolume(AudioManager.STREAM_MUSIC));}catch(Exception ex){data.putString("error",ex.toString());}
        Message response=Message.obtain(null,1);response.setData(data);try{if(message.replyTo!=null)message.replyTo.send(response);}catch(RemoteException ignored){}return true;
    }));
    @Override public IBinder onBind(Intent intent){return inbox.getBinder();}
}
