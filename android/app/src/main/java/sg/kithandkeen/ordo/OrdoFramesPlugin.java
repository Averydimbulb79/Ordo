package sg.kithandkeen.ordo;

import android.content.Context;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Last-resort native frame extraction for the shared compositor, including projects with text/effects. */
@CapacitorPlugin(name="OrdoFrames")
public class OrdoFramesPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Map<String,MediaMetadataRetriever> readers=new HashMap<>();
    private final Map<String,File> sources=new HashMap<>();
    private final Map<String,Long> lengths=new HashMap<>();
    @PluginMethod public void prepareSource(PluginCall call){worker.execute(()->{try{
        String id=call.getString("id","");if(!id.matches("[a-fA-F0-9-]{36}"))throw new IllegalArgumentException("Invalid frame source ID.");
        if(sources.containsKey(id))throw new IllegalStateException("Source already staged.");
        File file=new File(getContext().getCacheDir(),"ordo-frame-source-"+id+".media");
        try(FileOutputStream out=new FileOutputStream(file)){out.flush();}sources.put(id,file);lengths.put(id,0L);call.resolve();
    }catch(Exception e){call.reject("Could not prepare native source.",e);}});}
    @PluginMethod public void appendSource(PluginCall call){worker.execute(()->{try{
        String id=call.getString("id");File file=sources.get(id);String data=call.getString("data","");
        if(file==null||data.length()>350000||call.getLong("offset",-1L).longValue()!=lengths.get(id))throw new IllegalArgumentException("Invalid native source chunk.");
        byte[] bytes=Base64.decode(data,Base64.NO_WRAP);try(FileOutputStream out=new FileOutputStream(file,true)){out.write(bytes);}lengths.put(id,lengths.get(id)+bytes.length);call.resolve();
    }catch(Exception e){call.reject("Could not stage source video: "+e.getMessage(),e);}});}
    @Override public void load(){File[] stale=getContext().getCacheDir().listFiles((dir,name)->name.startsWith("ordo-frame-source-"));if(stale!=null)for(File f:stale)f.delete();}
    @PluginMethod public void read(PluginCall call) {
        worker.execute(()->{
            try {
                String id=call.getString("id"),source=call.getString("uri");
                int width=call.getInt("width",0),height=call.getInt("height",0);
                double seconds=call.getDouble("seconds",-1.0);
                if(id==null||source==null||(!"content".equals(Uri.parse(source).getScheme())&&!sources.containsKey(id))||width<1||height<1||width>8192||height>8192||!Double.isFinite(seconds)||seconds<0||seconds>86400)throw new IllegalArgumentException("Invalid native frame request.");
                MediaMetadataRetriever reader=readers.get(id);
                if(reader==null){reader=new MediaMetadataRetriever();try{if(sources.containsKey(id))reader.setDataSource(sources.get(id).getAbsolutePath());else reader.setDataSource(getContext(),Uri.parse(source));}catch(Exception e){reader.release();throw e;}readers.put(id,reader);}
                Bitmap bitmap=decodeFrame(reader,Math.round(seconds*1000000),width,height);
                try(ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                    if(!bitmap.compress(Bitmap.CompressFormat.PNG,100,bytes))throw new IllegalStateException("Native frame compression failed.");
                    call.resolve(new JSObject().put("data",Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP)));
                }finally{bitmap.recycle();}
            }catch(Exception e){call.reject("Native frame decoder: "+e.getMessage(),e);}
        });
    }
    static Bitmap decodeFrame(MediaMetadataRetriever reader,long timeUs,int width,int height) {
        // OPTION_CLOSEST decodes the requested picture, rather than repeating a keyframe.
        Bitmap bitmap=Build.VERSION.SDK_INT>=27?reader.getScaledFrameAtTime(timeUs,MediaMetadataRetriever.OPTION_CLOSEST,width,height):reader.getFrameAtTime(timeUs,MediaMetadataRetriever.OPTION_CLOSEST);
        if(bitmap==null)throw new IllegalStateException("Android returned no image at source "+(timeUs/1000000.0)+"s.");
        float scale=Math.min(1f,Math.min((float)width/bitmap.getWidth(),(float)height/bitmap.getHeight()));
        if(scale<1){Bitmap smaller=Bitmap.createScaledBitmap(bitmap,Math.max(1,Math.round(bitmap.getWidth()*scale)),Math.max(1,Math.round(bitmap.getHeight()*scale)),true);if(smaller!=bitmap)bitmap.recycle();bitmap=smaller;}
        return bitmap;
    }
    @PluginMethod public void close(PluginCall call) {
        worker.execute(()->{MediaMetadataRetriever reader=readers.remove(call.getString("id"));try{if(reader!=null)reader.release();File file=sources.remove(call.getString("id"));lengths.remove(call.getString("id"));if(file!=null)file.delete();call.resolve();}catch(Exception e){call.reject("Could not close native frame decoder.",e);}});
    }
    @Override protected void handleOnDestroy(){worker.execute(()->{for(MediaMetadataRetriever reader:readers.values())try{reader.release();}catch(Exception ignored){}readers.clear();for(File file:sources.values())file.delete();sources.clear();lengths.clear();});worker.shutdown();}
}
