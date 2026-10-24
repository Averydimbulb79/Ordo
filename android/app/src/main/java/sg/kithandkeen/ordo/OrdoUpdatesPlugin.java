package sg.kithandkeen.ordo;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Checks only the public release manifest. No project or media data is transmitted. */
@CapacitorPlugin(name="OrdoUpdates")
public class OrdoUpdatesPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    static final String APK="https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/Ordo-Android.apk";
    static final String MANIFEST="https://github.com/Averydimbulb79/Ordo/releases/download/android-latest/update.json";
    @PluginMethod public void check(PluginCall call){
        worker.execute(()->{
            HttpURLConnection connection=null;
            try {
                connection=(HttpURLConnection)new URL(MANIFEST+"?installed="+BuildConfig.VERSION_CODE+"&t="+System.currentTimeMillis()).openConnection();
                connection.setConnectTimeout(6000);connection.setReadTimeout(6000);connection.setUseCaches(false);connection.setRequestProperty("Accept","application/json");
                if(connection.getResponseCode()!=200){call.resolve(new JSObject().put("available",false));return;}
                try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1){if(out.size()+count>32768)throw new IllegalArgumentException("Release manifest too large.");out.write(buffer,0,count);}
                    JSONObject release=new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
                    if(!validRelease(release,BuildConfig.VERSION_CODE)){call.resolve(new JSObject().put("available",false));return;}
                    call.resolve(new JSObject().put("available",true).put("version",release.getString("version")).put("versionCode",release.getInt("versionCode")).put("currentVersion",BuildConfig.VERSION_NAME).put("currentVersionCode",BuildConfig.VERSION_CODE));
                }
            }catch(Exception ignored){call.resolve(new JSObject().put("available",false));}
            finally{if(connection!=null)connection.disconnect();}
        });
    }
    static boolean validRelease(JSONObject release,int installed) throws Exception {
        return release.getInt("versionCode")>installed&&release.getString("version").matches("[0-9]+\\.[0-9]+\\.[0-9]+")&&APK.equals(release.getString("apkUrl"))&&release.getString("sha256").matches("[a-f0-9]{64}");
    }
    @Override protected void handleOnDestroy(){worker.shutdownNow();}
    @PluginMethod public void download(PluginCall call){
        getActivity().runOnUiThread(()->{try{getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(APK)));call.resolve();}catch(Exception e){call.reject("Could not open the APK download. Visit Ordo's website to download the update.",e);}});
    }
}
