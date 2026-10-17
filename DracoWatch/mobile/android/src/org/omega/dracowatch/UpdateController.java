package org.omega.dracowatch;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.os.*;
import org.json.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Authenticated update checks/downloads; Android alone presents installation consent. */
final class UpdateController {
    interface Callback { void send(String callback,JSONObject value); }
    private final MonitorActivity activity; private final ExecutorService workers; private final Callback callback;
    private final SharedPreferences preferences;
    private final SharedPreferences.OnSharedPreferenceChangeListener installerListener;
    private final Handler main=new Handler(Looper.getMainLooper()); private final AtomicBoolean busy=new AtomicBoolean(false);
    private volatile JSONObject manifest; private volatile boolean closed;
    private volatile long surfacedInstallerResult=Long.MIN_VALUE;
    UpdateController(MonitorActivity activity,ExecutorService workers,Callback callback){this(activity,workers,callback,activity.getSharedPreferences("updates",Context.MODE_PRIVATE));}
    UpdateController(MonitorActivity activity,ExecutorService workers,Callback callback,SharedPreferences preferences){this.activity=activity;this.workers=workers;this.callback=callback;this.preferences=preferences;
        try{manifest=new JSONObject(preferences.getString("manifest","{}"));}catch(Exception ignored){}
        installerListener=(prefs,key)->{if(("lastInstallStatus".equals(key)||"lastInstallResultId".equals(key))&&!closed)main.post(()->reconcileInstallerResult());};
        preferences.registerOnSharedPreferenceChangeListener(installerListener);}
    private int installed(){try{return activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionCode;}catch(Exception ex){return 0;}}
    void event(String state,String error,long bytes,long total){JSONObject value=new JSONObject();try{
        value.put("state",state);if(error!=null)value.put("error",error);value.put("bytes",bytes);value.put("total",total);
        if(total>0)value.put("progress",Math.min(100,Math.round(100.0*bytes/total)));
        boolean actualIdentity="current".equals(state)||"installed".equals(state);JSONObject current=manifest;
        if(current!=null){if(!actualIdentity){value.put("versionName",current.optString("versionName"));value.put("versionCode",current.optInt("versionCode"));}value.put("notes",current.optString("notes"));}
        if("installed".equals(state)||"install-cancelled".equals(state)||"install-failed".equals(state)){
            value.put("installStatus",preferences.getInt("lastInstallStatus",PackageInstaller.STATUS_FAILURE));
            value.put("installSessionId",preferences.getInt("lastInstallSessionId",-1));value.put("installResultId",preferences.getLong("lastInstallResultId",0));}
        PackageInfo installed=activity.getPackageManager().getPackageInfo(activity.getPackageName(),0);
        value.put("currentVersion",installed.versionName);value.put("currentVersionCode",installed.versionCode);
        if(actualIdentity){value.put("versionName",installed.versionName);value.put("versionCode",installed.versionCode);}
        }catch(Exception ignored){}callback.send("onDracoUpdate",value);}
    void close(){closed=true;preferences.unregisterOnSharedPreferenceChangeListener(installerListener);main.removeCallbacksAndMessages(null);}
    /** Surfaces a new local receipt once. Raw installer evidence remains retained. */
    synchronized boolean reconcileInstallerResult(){if(closed||!preferences.contains("lastInstallStatus"))return false;
        long resultId=preferences.getLong("lastInstallResultId",0);
        if(surfacedInstallerResult==resultId||preferences.getLong("lastReconciledInstallResultId",Long.MIN_VALUE)==resultId)return false;
        preferences.edit().putLong("lastReconciledInstallResultId",resultId).commit();
        surfacedInstallerResult=resultId;int status=preferences.getInt("lastInstallStatus",PackageInstaller.STATUS_FAILURE);
        event(installerResultState(status),status==PackageInstaller.STATUS_SUCCESS?null:status==PackageInstaller.STATUS_FAILURE_ABORTED?
            "Android installation was cancelled. Your existing app is unchanged.":"Android did not install the update. Your existing app is unchanged.",0,0);
        return true;}
    static String installerResultState(int status){return status==PackageInstaller.STATUS_SUCCESS?"installed":status==PackageInstaller.STATUS_FAILURE_ABORTED?"install-cancelled":"install-failed";}
    static void clearInstallerResult(SharedPreferences preferences){preferences.edit().remove("lastInstallStatus").remove("lastInstallSessionId").commit();}
    void check(boolean explicit){if(closed||!explicit&&reconcileInstallerResult())return;long now=System.currentTimeMillis();android.content.SharedPreferences prefs=preferences;if(!explicit&&now-prefs.getLong("lastCheck",0)<60000)return;
        final long installerRevision=prefs.getLong("lastInstallResultId",0);
        if(!busy.compareAndSet(false,true))return;event("checking",null,0,0);workers.execute(()->{
            try{DracoClient.Response response=DracoClient.request(activity.currentProfile(),"GET","/v1/update",null,null);if(response.status!=200)throw new IOException();JSONObject value=response.data;validateManifest(value);verifyManifestIdentity(activity,value);
                if(!explicit&&installerRevision!=prefs.getLong("lastInstallResultId",0)){reconcileInstallerResult();return;}
                manifest=value;prefs.edit().putString("manifest",value.toString()).putLong("lastCheck",System.currentTimeMillis()).commit();
                if(value.getInt("versionCode")>installed()){event("available",null,0,value.getLong("bytes"));if(!explicit)main.post(()->prepareAutomatically(value));if(explicit)main.post(()->new AlertDialog.Builder(activity).setTitle("DRACO Watch "+value.optString("versionName")).setMessage(value.optString("notes","A new signed app update is available.")).setNegativeButton("Later",null).setPositiveButton("Download & update",(dialog,which)->install()).show());}
                else event("current",null,0,0);
            }catch(Exception ex){if(!explicit&&installerRevision!=prefs.getLong("lastInstallResultId",0))reconcileInstallerResult();else event("unavailable",explicit?"Update server is unavailable. Your installed app remains usable.":null,0,0);}
            finally{busy.set(false);}});
    }
    static void validateManifest(JSONObject value)throws Exception{
        if(!"org.omega.dracowatch".equals(value.getString("packageName"))||value.getInt("versionCode")<1||value.getString("versionName").length()>100||!value.getString("sha256").matches("[a-fA-F0-9]{64}")
            ||value.getLong("bytes")<=0||value.getLong("bytes")>DracoClient.APK_CAP||!"/v1/update/apk".equals(value.getString("path"))||value.optString("notes").length()>8000)throw new IOException("Invalid update manifest.");
    }
    static void verifyManifestIdentity(Context context,JSONObject value)throws Exception{
        if(!context.getPackageName().equals(value.getString("packageName")))throw new IOException("Update package mismatch.");
        String pin=value.optString("signingCertificateSha256","");if(pin.isEmpty())return;if(!pin.matches("[a-fA-F0-9]{64}"))throw new IOException("Invalid signer hash.");
        PackageInfo self=context.getPackageManager().getPackageInfo(context.getPackageName(),Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES);
        android.content.pm.Signature[] signers=Build.VERSION.SDK_INT>=28?self.signingInfo.getApkContentsSigners():self.signatures;
        boolean matched=false;for(android.content.pm.Signature signer:signers){byte[] hash=MessageDigest.getInstance("SHA-256").digest(signer.toByteArray());StringBuilder result=new StringBuilder();for(byte octet:hash)result.append(String.format(java.util.Locale.ROOT,"%02x",octet&255));if(result.toString().equalsIgnoreCase(pin))matched=true;}
        if(!matched)throw new IOException("Update signing certificate mismatch.");
    }
    private void prepareAutomatically(JSONObject selected){if(closed)return;if(!busy.compareAndSet(false,true)){main.postDelayed(()->prepareAutomatically(selected),250);return;}
        workers.execute(()->{try{event("downloading",null,0,selected.getLong("bytes"));prepare(activity,activity.currentProfile(),selected,(bytes,total)->event("downloading",null,bytes,total));event("ready",null,selected.getLong("bytes"),selected.getLong("bytes"));WatchJobService.updateNotification(activity,selected.optString("versionName"));}
        catch(Exception ex){event("error","Automatic update download is unavailable. Your installed app remains unchanged.",0,0);}finally{busy.set(false);}});
    }
    static synchronized File prepare(Context context,DracoClient.Profile profile,JSONObject selected,DracoClient.Progress progress)throws Exception{
        validateManifest(selected);verifyManifestIdentity(context,selected);File destination=new File(context.getFilesDir(),"update-"+selected.getString("sha256").toLowerCase(Locale.ROOT)+".apk");
        if(!destination.isFile()||destination.length()!=selected.getLong("bytes")||!DracoClient.sha256(destination).equalsIgnoreCase(selected.getString("sha256"))){File temporary=File.createTempFile("update-download-",".apk",context.getFilesDir());
            DracoClient.download(profile,"/v1/update/apk",temporary,DracoClient.APK_CAP,selected.getLong("bytes"),progress);
            if(!DracoClient.sha256(temporary).equalsIgnoreCase(selected.getString("sha256"))){temporary.delete();throw new IOException("Update digest mismatch.");}
            verifyArchive(context,temporary,selected.getInt("versionCode"));if(destination.exists())destination.delete();if(!temporary.renameTo(destination))throw new IOException("Cannot save update.");}
        verifyArchive(context,destination,selected.getInt("versionCode"));context.getSharedPreferences("updates",Context.MODE_PRIVATE).edit().putString("manifest",selected.toString()).commit();return destination;
    }
    void install(){if(closed)return;JSONObject selected=manifest;
        try{validateManifest(selected);verifyManifestIdentity(activity,selected);if(selected.getInt("versionCode")<=installed()){event("current",null,0,0);return;}}
        catch(Exception ex){check(true);return;}if(!busy.compareAndSet(false,true))return;
        // A fresh operator install attempt owns fresh progress. Retain terminal
        // evidence through every ordinary resume/read, but not into a new try.
        clearInstallerResult(preferences);surfacedInstallerResult=Long.MIN_VALUE;
        workers.execute(()->{try{event("downloading",null,0,selected.getLong("bytes"));
            final long[] last={0};File apk=prepare(activity,activity.currentProfile(),selected,(bytes,total)->{long now=SystemClock.elapsedRealtime();if(bytes==total||now-last[0]>120){last[0]=now;event("downloading",null,bytes,total);}});
            verifyArchive(activity,apk,selected.getInt("versionCode"));event("verified",null,apk.length(),apk.length());
            main.post(()->{if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()){event("permission",null,0,0);activity.requestUnknownSources();}
                else workers.execute(()->commit(selected,apk));});
        }catch(Exception ex){event("error","The update failed verification or download. Nothing was installed.",0,0);}
        finally{busy.set(false);}});
    }
    static void verifyArchive(Context context,File file,int expectedVersion)throws Exception{
        PackageManager pm=context.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo candidate=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags),self=pm.getPackageInfo(context.getPackageName(),flags);
        if(candidate==null||!context.getPackageName().equals(candidate.packageName)||candidate.versionCode!=expectedVersion||candidate.versionCode<=self.versionCode)throw new IOException("Update identity mismatch.");
        android.content.pm.Signature[] ours=Build.VERSION.SDK_INT>=28?self.signingInfo.getApkContentsSigners():self.signatures;
        android.content.pm.Signature[] theirs=Build.VERSION.SDK_INT>=28?candidate.signingInfo.getApkContentsSigners():candidate.signatures;
        if(ours==null||theirs==null||ours.length!=theirs.length||ours.length==0)throw new IOException("Update signer missing.");
        Set<String> expected=new HashSet<>();for(android.content.pm.Signature signer:ours)expected.add(Base64Digest(signer.toByteArray()));for(android.content.pm.Signature signer:theirs)if(!expected.remove(Base64Digest(signer.toByteArray())))throw new IOException("Update signer mismatch.");
        if(!expected.isEmpty())throw new IOException("Update signer mismatch.");
    }
    private static String Base64Digest(byte[] value)throws Exception{return android.util.Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(value),android.util.Base64.NO_WRAP);}
    private void commit(JSONObject selected,File apk){synchronized(UpdateController.class){PackageInstaller installer=activity.getPackageManager().getPackageInstaller();int sessionId=-1;
        try{if(apk.length()!=selected.getLong("bytes")||!DracoClient.sha256(apk).equalsIgnoreCase(selected.getString("sha256")))throw new IOException("Update digest changed.");verifyArchive(activity,apk,selected.getInt("versionCode"));PackageInstaller.SessionParams params=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);params.setAppPackageName(activity.getPackageName());params.setSize(apk.length());if(Build.VERSION.SDK_INT>=31)params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
            sessionId=installer.createSession(params);try(PackageInstaller.Session session=installer.openSession(sessionId)){
                MessageDigest copied=MessageDigest.getInstance("SHA-256");long written=0;
                try(InputStream input=new FileInputStream(apk);OutputStream output=session.openWrite("draco-update.apk",0,apk.length())){byte[] buffer=new byte[16384];int count;while((count=input.read(buffer))!=-1){written+=count;if(written>selected.getLong("bytes"))throw new IOException("Update grew during copy.");copied.update(buffer,0,count);output.write(buffer,0,count);}session.fsync(output);}
                if(written!=selected.getLong("bytes")||!MessageDigest.isEqual(copied.digest(),DracoClient.hex(selected.getString("sha256"))))throw new IOException("Installer copy digest mismatch.");
                Intent receipt=new Intent(activity,UpdateReceiver.class).setAction("org.omega.dracowatch.INSTALL_RESULT");PendingIntent pending=PendingIntent.getBroadcast(activity,sessionId,receipt,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));
                preferences.edit().putInt("sessionId",sessionId).remove("lastInstallStatus").remove("lastInstallSessionId").commit();
                // Enqueue consent state BEFORE asking Android to commit. Even
                // an immediate installer failure must remain the final event.
                event("awaiting-consent",null,apk.length(),apk.length());session.commit(pending.getIntentSender());}
        }catch(Exception ex){if(sessionId>=0)try{installer.abandonSession(sessionId);}catch(Exception ignored){}event("error","Android could not open the update installer. Your existing app is unchanged.",0,0);}
        }}
}
