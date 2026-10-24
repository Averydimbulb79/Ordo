package sg.kithandkeen.ordo;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.media3.common.C;
import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.Crop;
import androidx.media3.effect.MatrixTransformation;
import androidx.media3.effect.Presentation;
import androidx.media3.transformer.AudioEncoderSettings;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.DefaultEncoderFactory;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.EditedMediaItemSequence;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.ProgressHolder;
import androidx.media3.transformer.Transformer;
import androidx.media3.transformer.VideoEncoderSettings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.json.JSONObject;

/** Local, surface-based video export. JavaScript performs capability gating and audio mixing.
 * All Transformer calls run on the main looper. Source grants stay with Android's document provider.
 * Rendered video is copied directly to the user's chosen document, never through a WebView Blob.
 */
@UnstableApi
@CapacitorPlugin(name = "OrdoExport")
public class OrdoExportPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Job job;
    private static class Job {
        final String token = UUID.randomUUID().toString();
        final File directory, audio, video;
        long audioBytes;
        Transformer transformer;
        PluginCall renderCall;
        boolean rendered, selecting;
        volatile boolean cancelled;
        Job(File cache) throws Exception {
            directory = new File(cache, "ordo-export-" + token);
            if (!directory.mkdirs()) throw new Exception("Could not create export workspace.");
            audio = new File(directory, "mix.wav"); video = new File(directory, "video.mp4");
        }
        void delete() { audio.delete(); video.delete(); directory.delete(); }
    }
    @Override public void load() {
        // A process killed during rendering cannot execute discard; clear its private cache on restart.
        File[] stale = getContext().getCacheDir().listFiles((dir, name) -> name.startsWith("ordo-export-"));
        if (stale != null) for (File directory : stale) {
            File[] files = directory.listFiles();
            if (files != null) for (File file : files) file.delete();
            directory.delete();
        }
    }
    private Job require(PluginCall call) {
        if (job == null || job.cancelled || !job.token.equals(call.getString("token")))
            throw new IllegalStateException("Export session is no longer available.");
        return job;
    }
    @PluginMethod public void prepare(PluginCall call) {
        handler.post(() -> {
            try {
                if (job != null) throw new IllegalStateException("Another native export is active.");
                job = new Job(getContext().getCacheDir());
                call.resolve(new JSObject().put("token", job.token));
            } catch (Exception e) { call.reject(e.getMessage(), e); }
        });
    }
    @PluginMethod public void appendAudio(PluginCall call) {
        handler.post(() -> {
            try {
                Job j = require(call);
                if (j.transformer != null || j.rendered) throw new IllegalStateException("Audio is already sealed.");
                long offset = call.getLong("offset", -1L);
                if (offset != j.audioBytes) throw new IllegalArgumentException("Audio chunk offset mismatch.");
                String data = call.getString("data", "");
                if (data.length() > 350000) throw new IllegalArgumentException("Audio chunk is too large.");
                byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
                try (FileOutputStream out = new FileOutputStream(j.audio, true)) { out.write(bytes); }
                j.audioBytes += bytes.length; call.resolve();
            } catch (Exception e) { call.reject(e.getMessage(), e); }
        });
    }
    @PluginMethod public void render(PluginCall call) {
        handler.post(() -> {
            Job j = null;
            try {
                j = require(call);
                if (j.transformer != null || j.rendered) throw new IllegalStateException("Export has already started.");
                int width = call.getInt("width", 0), height = call.getInt("height", 0), fps = call.getInt("fps", 30), bitrate = call.getInt("bitrate", 0);
                if (width < 2 || height < 2 || width > 16384 || height > 16384 || fps < 1 || fps > 60 || bitrate < 1)
                    throw new IllegalArgumentException("Invalid native export settings.");
                JSArray clips = call.getArray("clips", new JSArray());
                if (clips.length() == 0) throw new IllegalArgumentException("Add a picture clip before exporting.");
                Composition composition = buildComposition(clips, width, height, fps, j.audio);
                DefaultEncoderFactory factory = new DefaultEncoderFactory.Builder(getContext())
                    .setRequestedVideoEncoderSettings(new VideoEncoderSettings.Builder().setBitrate(bitrate).build())
                    .setRequestedAudioEncoderSettings(new AudioEncoderSettings.Builder().setBitrate(128000).build())
                    .setEnableFallback(false).build();
                final Job active = j;
                j.renderCall = call;
                j.transformer = new Transformer.Builder(getContext()).setEncoderFactory(factory)
                    .setVideoMimeType(call.getBoolean("hevc", false) ? MimeTypes.VIDEO_H265 : MimeTypes.VIDEO_H264)
                    .setAudioMimeType(MimeTypes.AUDIO_AAC)
                    .addListener(new Transformer.Listener() {
                        @Override public void onCompleted(Composition c, ExportResult result) {
                            if (active.cancelled) return;
                            active.rendered = true; active.transformer = null;
                            PluginCall pending = active.renderCall; active.renderCall = null;
                            if (pending != null) pending.resolve();
                        }
                        @Override public void onError(Composition c, ExportResult result, ExportException error) {
                            if (active.cancelled) return;
                            active.transformer = null;
                            PluginCall pending = active.renderCall; active.renderCall = null;
                            if (pending != null) pending.reject("Native codec export failed: " + error.getMessage(), error);
                        }
                    }).build();
                j.transformer.start(composition, j.video.getAbsolutePath());
                poll(j);
            } catch (Exception e) {
                if (j != null) { if (j.transformer != null) j.transformer.cancel(); j.transformer = null; j.renderCall = null; }
                call.reject("Native export could not start: " + e.getMessage(), e);
            }
        });
    }
    static Composition buildComposition(JSArray clips, int width, int height, int fps, File audio) throws Exception {
                EditedMediaItemSequence.Builder pictures = new EditedMediaItemSequence.Builder(Collections.singleton(C.TRACK_TYPE_VIDEO));
                for (int i = 0; i < clips.length(); i++) {
                    JSONObject c = clips.getJSONObject(i);
                    Uri uri = Uri.parse(c.getString("uri"));
                    if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("Native export requires an Android document URI.");
                    long inUs = Math.round(c.getDouble("inFrame") * 1000000 / 30), durationUs = Math.round(c.getDouble("frames") * 1000000 / 30);
                    if (inUs < 0 || durationUs <= 0) throw new IllegalArgumentException("Invalid native clip range.");
                    boolean image = "image".equals(c.getString("kind"));
                    MediaItem.Builder media = new MediaItem.Builder().setUri(uri);
                    if (image) media.setImageDurationMs((durationUs + 999) / 1000);
                    else media.setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder().setStartPositionUs(inUs).setEndPositionUs(inUs + durationUs).build());
                    List<Effect> effects = new ArrayList<>();
                    JSONObject crop = c.optJSONObject("crop");
                    if (crop != null) {
                        float x = (float) crop.getDouble("x"), y = (float) crop.getDouble("y"), w = (float) crop.getDouble("width"), h = (float) crop.getDouble("height");
                        effects.add(new Crop(2*x-1, 2*(x+w)-1, 1-2*(y+h), 1-2*y));
                    }
                    effects.add(Presentation.createForWidthAndHeight(width, height, Presentation.LAYOUT_SCALE_TO_FIT));
                    final float scale = (float)c.optDouble("scale", 1), x = (float)c.optDouble("x", .5), y = (float)c.optDouble("y", .5);
                    if (scale != 1 || x != .5f || y != .5f) {
                        Matrix transform = new Matrix(); transform.setScale(scale, scale); transform.postTranslate(2*x-1, 1-2*y);
                        effects.add((MatrixTransformation) timeUs -> transform);
                    }
                    EditedMediaItem.Builder item = new EditedMediaItem.Builder(media.build()).setRemoveAudio(true).setFrameRate(fps).setEffects(new Effects(Collections.emptyList(), effects));
                    if (image) item.setDurationUs(durationUs);
                    pictures.addItem(item.build());
                }
                List<EditedMediaItemSequence> sequences = new ArrayList<>(); sequences.add(pictures.build());
                if (audio != null && audio.length() > 44) {
                    sequences.add(new EditedMediaItemSequence.Builder(Collections.singleton(C.TRACK_TYPE_AUDIO))
                        .addItem(new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(audio))).setRemoveVideo(true).build()).build());
                }
                return new Composition.Builder(sequences)
                    .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL).build();
    }
    private void poll(Job j) {
        if (j.cancelled || j.transformer == null) return;
        ProgressHolder holder = new ProgressHolder();
        if (j.transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE)
            notifyListeners("progress", new JSObject().put("token", j.token).put("progress", holder.progress / 100.0));
        handler.postDelayed(() -> poll(j), 250);
    }
    @PluginMethod public void save(PluginCall call) {
        handler.post(() -> {
            try {
                Job j = require(call);
                if (!j.rendered || j.selecting) throw new IllegalStateException("No completed video is ready to save.");
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("video/mp4");
                intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "Ordo.mp4"));
                j.selecting = true; startActivityForResult(call, intent, "saveChosen");
            } catch (Exception e) { call.reject("Could not open the save picker.", e); }
        });
    }
    @ActivityCallback private void saveChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Job j = job;
        if (j == null || j.cancelled || !j.token.equals(call.getString("token")) || result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            if (j != null) j.selecting = false;
            call.resolve(new JSObject().put("cancelled", true)); return;
        }
        Uri destination = result.getData().getData();
        getBridge().execute(() -> {
            try (FileInputStream in = new FileInputStream(j.video); OutputStream out = getContext().getContentResolver().openOutputStream(destination, "wt")) {
                if (out == null) throw new IllegalStateException("Could not write the chosen document.");
                byte[] buffer = new byte[256 * 1024]; int count;
                while ((count = in.read(buffer)) != -1) { if (j.cancelled) throw new IllegalStateException("Export cancelled."); out.write(buffer, 0, count); }
                out.flush(); call.resolve(new JSObject().put("cancelled", false));
            } catch (Exception e) {
                try { getContext().getContentResolver().delete(destination, null, null); } catch (Exception ignored) { }
                call.reject("Could not save the native video: " + e.getMessage(), e);
            } finally { j.selecting = false; }
        });
    }
    @PluginMethod public void discard(PluginCall call) {
        handler.post(() -> {
            if (job != null && job.token.equals(call.getString("token"))) { dispose(job); job = null; }
            call.resolve();
        });
    }
    private void dispose(Job j) {
        j.cancelled = true;
        if (j.transformer != null) j.transformer.cancel();
        j.transformer = null;
        if (j.renderCall != null) j.renderCall.reject("Export cancelled.");
        j.renderCall = null; j.delete();
    }
    @Override protected void handleOnDestroy() {
        handler.post(() -> { if (job != null) { dispose(job); job = null; } });
    }
}
