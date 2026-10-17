package org.omega.dracowatch;

import android.content.*;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

public final class UpdateReceiver extends BroadcastReceiver {
    /** Terminal receipt persistence, separated from UI/installer work for exact local reconciliation. */
    static boolean recordResult(SharedPreferences preferences,int status,int receiptSession){
        if(status==PackageInstaller.STATUS_PENDING_USER_ACTION)return false;
        int activeSession=preferences.getInt("sessionId",-1);
        if(activeSession>=0&&receiptSession>=0&&activeSession!=receiptSession)return false;
        int session=receiptSession>=0?receiptSession:activeSession;
        if(activeSession<0&&preferences.contains("lastInstallStatus")
            &&preferences.getInt("lastInstallSessionId",-1)==session
            &&preferences.getInt("lastInstallStatus",PackageInstaller.STATUS_FAILURE)==status)return false;
        long resultId=preferences.getLong("lastInstallResultId",0)+1;
        return preferences.edit().putInt("sessionId",-1).putInt("lastInstallStatus",status)
            .putInt("lastInstallSessionId",session).putLong("lastInstallResultId",resultId).commit();
    }
    @Override public void onReceive(Context context,Intent intent){
        if(!"org.omega.dracowatch.INSTALL_RESULT".equals(intent.getAction()))return;
        int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
        if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){Intent consent=intent.getParcelableExtra(Intent.EXTRA_INTENT);if(consent!=null){consent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);try{context.startActivity(consent);}catch(Exception ex){Toast.makeText(context,"Open DRACO Watch to finish the Android update.",Toast.LENGTH_LONG).show();}}return;}
        if(!recordResult(context.getSharedPreferences("updates",Context.MODE_PRIVATE),status,
            intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID,-1)))return;
        Toast.makeText(context,status==PackageInstaller.STATUS_SUCCESS?"DRACO Watch updated. Your pairing and messages were preserved.":"The Android update was not installed. Your existing app is unchanged.",Toast.LENGTH_LONG).show();
    }
}
