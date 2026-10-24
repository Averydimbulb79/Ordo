package sg.kithandkeen.ordo;

import static org.junit.Assert.*;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import androidx.core.content.FileProvider;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.transformer.*;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@UnstableApi
@RunWith(AndroidJUnit4.class)
public class NativeExportTest {
    private File picture(Context context, String name, int color) throws Exception {
        File file = new File(context.getCacheDir(), name);
        Bitmap bitmap = Bitmap.createBitmap(640, 360, Bitmap.Config.ARGB_8888); bitmap.eraseColor(color);
        try (FileOutputStream out = new FileOutputStream(file)) { bitmap.compress(Bitmap.CompressFormat.PNG, 100, out); }
        bitmap.recycle(); return file;
    }
    private JSObject clip(Context context, File file) {
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName()+".fileprovider", file);
        return new JSObject().put("uri", uri.toString()).put("kind", "image").put("inFrame", 0).put("frames", 30);
    }
    private File tone(Context context) throws Exception {
        int samples = 96000, size = samples*4; ByteBuffer b=ByteBuffer.allocate(44+size).order(ByteOrder.LITTLE_ENDIAN);
        b.put(new byte[]{'R','I','F','F'}).putInt(36+size).put(new byte[]{'W','A','V','E','f','m','t',' '}).putInt(16).putShort((short)1).putShort((short)2).putInt(48000).putInt(192000).putShort((short)4).putShort((short)16).put(new byte[]{'d','a','t','a'}).putInt(size);
        for(int i=0;i<samples;i++){short value=(short)(Math.sin(i*2*Math.PI*440/48000)*6000);b.putShort(value).putShort(value);}
        File file=new File(context.getCacheDir(),"native-tone.wav");try(FileOutputStream out=new FileOutputStream(file)){out.write(b.array());}return file;
    }
    private void render(Context context, Composition composition, File output) throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<Exception> failure=new AtomicReference<>();AtomicReference<Transformer> transformer=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
            try {
                Transformer t=new Transformer.Builder(context).setVideoMimeType(MimeTypes.VIDEO_H264).setAudioMimeType(MimeTypes.AUDIO_AAC)
                    .setEncoderFactory(new DefaultEncoderFactory.Builder(context).setRequestedVideoEncoderSettings(new VideoEncoderSettings.Builder().setBitrate(1000000).build()).setEnableFallback(false).build())
                    .addListener(new Transformer.Listener(){
                        @Override public void onCompleted(Composition c,ExportResult r){done.countDown();}
                        @Override public void onError(Composition c,ExportResult r,ExportException e){failure.set(e);done.countDown();}
                    }).build();transformer.set(t);t.start(composition,output.getAbsolutePath());
            }catch(Exception e){failure.set(e);done.countDown();}
        });
        try{assertTrue("Native render timed out",done.await(90,TimeUnit.SECONDS));if(failure.get()!=null)throw failure.get();}
        finally{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{if(transformer.get()!=null)transformer.get().cancel();});}
    }
    @Test public void updateManifestAcceptsOnlyNewerTrustedRelease() throws Exception {
        org.json.JSONObject release=new org.json.JSONObject().put("version","0.8.0").put("versionCode",12).put("apkUrl",OrdoUpdatesPlugin.APK).put("sha256",String.join("",java.util.Collections.nCopies(64,"a")));
        assertTrue(OrdoUpdatesPlugin.validRelease(release,11));assertFalse(OrdoUpdatesPlugin.validRelease(release,12));assertFalse(OrdoUpdatesPlugin.validRelease(release,13));
        release.put("apkUrl","https://example.com/update.apk");assertFalse(OrdoUpdatesPlugin.validRelease(release,11));
    }
    @Test public void nativeImagesCropPlacementAndAudioThenVideoTrim() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        File red=picture(context,"native-red.png",Color.RED),blue=picture(context,"native-blue.png",Color.BLUE),audio=tone(context),first=new File(context.getCacheDir(),"native-first.mp4"),trimmed=new File(context.getCacheDir(),"native-trim.mp4");
        first.delete();trimmed.delete();
        try {
            JSObject a=clip(context,red).put("crop",new JSObject().put("x",.5).put("y",0).put("width",.5).put("height",1));
            JSObject b=clip(context,blue).put("scale",.5).put("x",.75).put("y",.5);
            render(context,OrdoExportPlugin.buildComposition(new JSArray(java.util.Arrays.asList(a,b)),320,180,30,audio),first);
            try(MediaMetadataRetriever reader=new MediaMetadataRetriever()){
                reader.setDataSource(first.getAbsolutePath());
                assertEquals("320",reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
                assertEquals("180",reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
                assertEquals("yes",reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO));
                long ms=Long.parseLong(reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));assertTrue("duration "+ms,ms>=1950&&ms<=2100);
                Bitmap f=reader.getFrameAtTime(250000,MediaMetadataRetriever.OPTION_CLOSEST);assertTrue(Color.red(f.getPixel(160,90))>180);assertTrue(Color.red(f.getPixel(20,90))<30);f.recycle();
                f=reader.getFrameAtTime(1250000,MediaMetadataRetriever.OPTION_CLOSEST);assertTrue(Color.blue(f.getPixel(240,90))>180);assertTrue(Color.blue(f.getPixel(80,90))<30);f.recycle();
            }
            try(MediaMetadataRetriever nativeReader=new MediaMetadataRetriever()){
                nativeReader.setDataSource(context,FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",first));
                Bitmap recovered=OrdoFramesPlugin.decodeFrame(nativeReader,1250000,160,90);
                assertTrue("native recovery returns the requested picture",Color.blue(recovered.getPixel(recovered.getWidth()*3/4,recovered.getHeight()/2))>180);
                assertTrue(recovered.getWidth()<=160&&recovered.getHeight()<=90);recovered.recycle();
            }
            JSObject video=clip(context,first).put("kind","video").put("inFrame",30).put("frames",30);
            render(context,OrdoExportPlugin.buildComposition(new JSArray(java.util.Collections.singletonList(video)),320,180,24,null),trimmed);
            try(MediaMetadataRetriever reader=new MediaMetadataRetriever()){
                reader.setDataSource(trimmed.getAbsolutePath());Bitmap f=reader.getFrameAtTime(250000,MediaMetadataRetriever.OPTION_CLOSEST);
                assertTrue("trim selects second source picture",Color.blue(f.getPixel(240,90))>180);f.recycle();
                long ms=Long.parseLong(reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));assertTrue("trim duration "+ms,ms>=950&&ms<=1100);
            }
        } finally {red.delete();blue.delete();audio.delete();first.delete();trimmed.delete();}
    }
}
