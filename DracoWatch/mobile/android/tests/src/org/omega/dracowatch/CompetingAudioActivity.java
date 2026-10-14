package org.omega.dracowatch;

import android.app.Activity;
import android.media.*;
import android.os.Bundle;
import android.widget.TextView;
import java.io.*;
import java.nio.*;

/** Separate test-APK UID: continuous synthetic music, never an agent voice. */
public final class CompetingAudioActivity extends Activity {
    static MediaPlayer music; static AudioFocusRequest focus;
    static AudioManager audio; static int focusLosses, focusGranted; static String error="";
    @Override public void onCreate(Bundle state){super.onCreate(state);TextView label=new TextView(this);label.setText("Isolated competing audio fixture");setContentView(label);
        try{focusLosses=0;audio=(AudioManager)getSystemService(AUDIO_SERVICE);
            AudioAttributes attrs=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
            focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attrs).setOnAudioFocusChangeListener(change->{if(change<0)focusLosses++;}).build();
            focusGranted=audio.requestAudioFocus(focus);
            File tone=tone(new File(getCacheDir(),"competing-tone.wav"),660);
            music=new MediaPlayer();music.setAudioAttributes(attrs);music.setDataSource(tone.getPath());music.setLooping(true);music.prepare();music.start();
        }catch(Exception ex){error=ex.toString();}}
    static File tone(File file,double frequency)throws Exception{
        int rate=48000,frames=rate*32;ByteBuffer out=ByteBuffer.allocate(44+frames*2).order(ByteOrder.LITTLE_ENDIAN);
        out.put("RIFF".getBytes("US-ASCII")).putInt(36+frames*2).put("WAVEfmt ".getBytes("US-ASCII")).putInt(16).putShort((short)1).putShort((short)1).putInt(rate).putInt(rate*2).putShort((short)2).putShort((short)16).put("data".getBytes("US-ASCII")).putInt(frames*2);
        for(int i=0;i<frames;i++)out.putShort((short)(5000*Math.sin(2*Math.PI*frequency*i/rate)));
        try(FileOutputStream stream=new FileOutputStream(file)){stream.write(out.array());}return file;
    }
    static void stop(){if(music!=null){music.release();music=null;}if(audio!=null&&focus!=null)audio.abandonAudioFocusRequest(focus);focus=null;}
    // Deliberately continue as a music app when the target client comes forward.
}
