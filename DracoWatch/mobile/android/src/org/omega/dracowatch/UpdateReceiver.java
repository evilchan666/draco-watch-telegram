package org.omega.dracowatch;

import android.content.*;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

public final class UpdateReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        if(!"org.omega.dracowatch.INSTALL_RESULT".equals(intent.getAction()))return;
        int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
        if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){Intent consent=intent.getParcelableExtra(Intent.EXTRA_INTENT);if(consent!=null){consent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);try{context.startActivity(consent);}catch(Exception ex){Toast.makeText(context,"Open DRACO Watch to finish the Android update.",Toast.LENGTH_LONG).show();}}return;}
        context.getSharedPreferences("updates",Context.MODE_PRIVATE).edit().putInt("sessionId",-1).putInt("lastInstallStatus",status).commit();
        Toast.makeText(context,status==PackageInstaller.STATUS_SUCCESS?"DRACO Watch updated. Your pairing and messages were preserved.":"The Android update was not installed. Your existing app is unchanged.",Toast.LENGTH_LONG).show();
    }
}
