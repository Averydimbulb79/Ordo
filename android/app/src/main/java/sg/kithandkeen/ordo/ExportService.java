package sg.kithandkeen.ordo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/** Keeps native encoding running while the user switches apps or turns the screen off. */
@android.annotation.SuppressLint("MissingPermission") // Notification permission is optional and requested before export.
public final class ExportService extends Service {
    private static final String CHANNEL="ordo-export";
    private static final int ID=800;
    private PowerManager.WakeLock wakeLock;
    static volatile boolean active;
    static Runnable cancel;
    private static Notification.Builder builder(android.content.Context context){return Build.VERSION.SDK_INT>=26?new Notification.Builder(context,CHANNEL):new Notification.Builder(context);}
    private Notification notification(String text,int progress,boolean finished){
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=builder(this).setSmallIcon(android.R.drawable.stat_sys_upload).setContentTitle(finished?"Ordo export complete":"Ordo is exporting").setContentText(text).setContentIntent(open).setOngoing(!finished).setOnlyAlertOnce(true);
        if(!finished)builder.setProgress(100,Math.max(0,progress),progress<0).addAction(new Notification.Action.Builder(null,"Cancel",PendingIntent.getService(this,1,new Intent(this,ExportService.class).setAction("cancel"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)).build());
        return builder.build();
    }
    @Override public void onCreate(){super.onCreate();if(Build.VERSION.SDK_INT>=26)getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"Video export",NotificationManager.IMPORTANCE_LOW));}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null&&"cancel".equals(intent.getAction())){if(cancel!=null)cancel.run();stopSelf();return START_NOT_STICKY;}
        Notification n=notification("Rendering on Android. You can switch apps.",-1,false);
        if(Build.VERSION.SDK_INT>=35)startForeground(ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING);
        else if(Build.VERSION.SDK_INT>=29)startForeground(ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(ID,n);
        active=true;
        wakeLock=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Ordo:export");wakeLock.acquire(6*60*60*1000L);
        return START_NOT_STICKY;
    }
    static void update(android.content.Context context,int percent){
        if(!active)return;
        PendingIntent open=PendingIntent.getActivity(context,0,new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=builder(context).setSmallIcon(android.R.drawable.stat_sys_upload).setContentTitle("Ordo is exporting").setContentText("Rendering video · "+percent+"%").setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setProgress(100,percent,false).addAction(new Notification.Action.Builder(null,"Cancel",PendingIntent.getService(context,1,new Intent(context,ExportService.class).setAction("cancel"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)).build()).build();
        context.getSystemService(NotificationManager.class).notify(ID,n);
    }
    static void finish(android.content.Context context,boolean completed){
        active=false;cancel=null;context.stopService(new Intent(context,ExportService.class));
        if(completed){PendingIntent open=PendingIntent.getActivity(context,0,new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);context.getSystemService(NotificationManager.class).notify(ID+1,builder(context).setSmallIcon(android.R.drawable.stat_sys_upload_done).setContentTitle("Ordo export complete").setContentText("Return to Ordo to choose where to save your video.").setContentIntent(open).setAutoCancel(true).build());}
    }
    @Override public void onTimeout(int startId,int fgsType){if(cancel!=null)cancel.run();stopSelf();}
    @Override public void onDestroy(){active=false;if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
