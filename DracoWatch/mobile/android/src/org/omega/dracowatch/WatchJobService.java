package org.omega.dracowatch;

import android.Manifest;
import android.app.*;
import android.app.job.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.*;

/** Opt-in Android scheduled observation, never starts work or sends agent commands. */
public final class WatchJobService extends JobService {
    static final int JOB=190013; static final String CHANNEL="draco-observation";private volatile boolean stopped;
    static void schedule(Context context,boolean enabled){JobScheduler scheduler=(JobScheduler)context.getSystemService(JOB_SCHEDULER_SERVICE);if(!enabled){scheduler.cancel(JOB);return;}
        scheduler.schedule(new JobInfo.Builder(JOB,new ComponentName(context,WatchJobService.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(60*60*1000L,15*60*1000L).build());}
    @Override public boolean onStartJob(JobParameters params){if(!getSharedPreferences("phone",MODE_PRIVATE).getBoolean("notifications",false))return false;stopped=false;new Thread(()->{
        try{DracoClient.Profile profile=DracoClient.loadProfile(this);if(profile==null)return;
            DracoClient.Response update=DracoClient.request(profile,"GET","/v1/update",null,null);if(update.status==200){UpdateController.validateManifest(update.data);int installed=getPackageManager().getPackageInfo(getPackageName(),0).versionCode;if(update.data.getInt("versionCode")>installed&&!stopped){UpdateController.prepare(this,profile,update.data,null);notify(11,"DRACO Watch update ready","Open to install "+update.data.optString("versionName")+" through Android.");}}
            String agent=getSharedPreferences("phone",MODE_PRIVATE).getString("agent","main");if(!DracoClient.AGENTS.contains(agent))agent="main";
            DracoClient.Response snapshot=DracoClient.request(profile,"GET","/v1/snapshot?agent="+agent,null,null);JSONArray messages=snapshot.data.optJSONArray("conversation");
            if(snapshot.status==200&&snapshot.data.optBoolean("connected")&&messages!=null){String latest="";for(int i=messages.length()-1;i>=0;i--){JSONObject message=messages.getJSONObject(i);if("assistant".equals(message.optString("role"))){latest=message.optString("id");break;}}
                android.content.SharedPreferences prefs=getSharedPreferences("phone",MODE_PRIVATE);String previous=prefs.getString("notificationLast-"+agent,"");if(!latest.isEmpty()&&!latest.equals(previous)){prefs.edit().putString("notificationLast-"+agent,latest).commit();if(!previous.isEmpty()&&!stopped)notify(12,"New DRACO reply","Open the client to read your latest reply.");}}
        }catch(Exception ignored){}finally{if(!stopped)jobFinished(params,false);}},"draco-observe").start();return true;}
    static void updateNotification(Context context,String version){if(!context.getSharedPreferences("phone",MODE_PRIVATE).getBoolean("notifications",false))return;if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;NotificationManager manager=(NotificationManager)context.getSystemService(NOTIFICATION_SERVICE);manager.createNotificationChannel(new NotificationChannel(CHANNEL,"DRACO replies and updates",NotificationManager.IMPORTANCE_DEFAULT));PendingIntent open=PendingIntent.getActivity(context,0,new Intent(context,MonitorActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);manager.notify(11,new Notification.Builder(context,CHANNEL).setSmallIcon(org.omega.dracowatch.R.drawable.ic_draco).setContentTitle("DRACO Watch update ready").setContentText("Open to install "+version+" through Android.").setContentIntent(open).setAutoCancel(true).build());}
    private void notify(int id,String title,String text){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);manager.createNotificationChannel(new NotificationChannel(CHANNEL,"DRACO replies and updates",NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MonitorActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);manager.notify(id,new Notification.Builder(this,CHANNEL).setSmallIcon(org.omega.dracowatch.R.drawable.ic_draco).setContentTitle(title).setContentText(text).setContentIntent(open).setAutoCancel(true).build());}
    @Override public boolean onStopJob(JobParameters params){stopped=true;return false;}
}
