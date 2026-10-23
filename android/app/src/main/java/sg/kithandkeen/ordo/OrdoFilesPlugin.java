package sg.kithandkeen.ordo;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.database.Cursor;
import android.provider.OpenableColumns;
import com.getcapacitor.JSArray;
import java.util.ArrayList;
import java.util.List;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.UUID;

/** Writes only to the document explicitly chosen by the user. No broad storage permissions. */
@CapacitorPlugin(name = "OrdoFiles")
public class OrdoFilesPlugin extends Plugin {
    private OutputStream stream;
    private Uri uri;
    private String token;
    private long written;
    private long expected;
    private boolean selecting;
    private boolean previewing;
    private int previousOrientation;
    private int previousBarBehavior;
    private int visibleBars;

    @PluginMethod
    public void pickMedia(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "video/*", "audio/*", "application/octet-stream" });
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        try { startActivityForResult(call, intent, "mediaChosen"); }
        catch (Exception error) { call.reject("Could not open the media picker.", error); }
    }

    @ActivityCallback
    private void mediaChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("files", new JSArray())); return;
        }
        Intent data = result.getData();
        List<Uri> uris = new ArrayList<>();
        ClipData clips = data.getClipData();
        if (clips != null) for (int i = 0; i < clips.getItemCount(); i++) uris.add(clips.getItemAt(i).getUri());
        else if (data.getData() != null) uris.add(data.getData());
        getBridge().execute(() -> {
            JSArray files = new JSArray();
            for (Uri selected : uris) {
                boolean persisted = false;
                try { if (call.getBoolean("remember", true)) { getContext().getContentResolver().takePersistableUriPermission(selected, Intent.FLAG_GRANT_READ_URI_PERMISSION); persisted = true; } }
                catch (SecurityException ignored) { /* A provider may offer session-only access. */ }
                String name = "Media";
                try (Cursor cursor = getContext().getContentResolver().query(selected, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0);
                } catch (Exception ignored) { /* File decoding reports unreadable sources. */ }
                String mime = "application/octet-stream";
                try { mime = getContext().getContentResolver().getType(selected); } catch (Exception ignored) {}
                files.put(new JSObject().put("uri", selected.toString()).put("name", name == null ? "Media" : name).put("persisted", persisted).put("mime", mime));
            }
            call.resolve(new JSObject().put("files", files));
        });
    }

    @PluginMethod
    public void forgetMedia(PluginCall call) {
        for (android.content.UriPermission grant : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (grant.isReadPermission()) {
                try { getContext().getContentResolver().releasePersistableUriPermission(grant.getUri(), Intent.FLAG_GRANT_READ_URI_PERMISSION); }
                catch (SecurityException ignored) { /* Already revoked. */ }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public synchronized void beginSave(PluginCall call) {
        if (stream != null || selecting) { call.reject("Another file save is already active."); return; }
        String name = call.getString("name");
        Long size = SaveByteCount.read(call.getData().opt("size"));
        if (name == null || name.trim().isEmpty()) { call.reject("Choose a non-empty file name."); return; }
        if (size == null) { call.reject("Invalid file size. Saving currently supports files up to 256 MB."); return; }
        expected = size;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, name.replaceAll("[\\\\/\\x00-\\x1F]", "_"));
        selecting = true;
        try { startActivityForResult(call, intent, "documentChosen"); }
        catch (Exception error) { selecting = false; call.reject("Could not open Android Save as.", error); }
    }

    @ActivityCallback
    private synchronized void documentChosen(PluginCall call, ActivityResult result) {
        selecting = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("cancelled", true)); return;
        }
        try {
            uri = result.getData().getData();
            stream = getContext().getContentResolver().openOutputStream(uri, "wt");
            if (stream == null) throw new java.io.IOException("Provider returned no output stream");
            written = 0; token = UUID.randomUUID().toString();
            call.resolve(new JSObject().put("cancelled", false).put("token", token));
        } catch (Exception error) { cleanup(true); call.reject("Could not create the selected file.", error); }
    }

    private boolean valid(PluginCall call) {
        if (stream == null || token == null || !token.equals(call.getString("token"))) {
            call.reject("This file save is no longer active."); return false;
        }
        return true;
    }

    @PluginMethod
    public synchronized void append(PluginCall call) {
        if (!valid(call)) return;
        try {
            String data = call.getString("data"); Long offset = SaveByteCount.read(call.getData().opt("offset"));
            if (data == null || data.length() > 400000 || offset == null || offset != written) throw new IllegalArgumentException("Invalid chunk order or size");
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            if (written + bytes.length > expected) throw new IllegalArgumentException("File exceeds declared size");
            stream.write(bytes); written += bytes.length; call.resolve();
        } catch (Exception error) { cleanup(true); call.reject("Could not write the complete file.", error); }
    }

    @PluginMethod
    public synchronized void finish(PluginCall call) {
        if (!valid(call)) return;
        try {
            if (written != expected) throw new java.io.IOException("File is incomplete");
            stream.flush(); stream.close(); stream = null; uri = null; token = null; call.resolve();
        } catch (Exception error) { cleanup(true); call.reject("Could not finish saving the file.", error); }
    }

    @PluginMethod
    public synchronized void abort(PluginCall call) {
        if (!valid(call)) return;
        cleanup(true); call.resolve();
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        getActivity().runOnUiThread(() -> {
            if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void previewMode(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        getActivity().runOnUiThread(() -> {
            try {
                Activity activity = getActivity();
                WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
                if (enabled && !previewing) {
                    previousOrientation = activity.getRequestedOrientation();
                    previousBarBehavior = bars.getSystemBarsBehavior();
                    WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(activity.getWindow().getDecorView());
                    visibleBars = 0;
                    for (int type : new int[] { WindowInsetsCompat.Type.statusBars(), WindowInsetsCompat.Type.navigationBars(), WindowInsetsCompat.Type.captionBar() }) {
                        if (insets == null || insets.isVisible(type)) visibleBars |= type;
                    }
                    previewing = true;
                    activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR);
                    bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    bars.hide(WindowInsetsCompat.Type.systemBars());
                } else if (!enabled && previewing) {
                    activity.setRequestedOrientation(previousOrientation);
                    bars.setSystemBarsBehavior(previousBarBehavior);
                    bars.hide(WindowInsetsCompat.Type.systemBars());
                    if (visibleBars != 0) bars.show(visibleBars);
                    previewing = false;
                }
                call.resolve();
            } catch (Exception error) { call.reject("Could not change fullscreen preview mode.", error); }
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (previewing) getActivity().runOnUiThread(() -> WindowCompat.getInsetsController(getActivity().getWindow(), getActivity().getWindow().getDecorView()).hide(WindowInsetsCompat.Type.systemBars()));
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration config) {
        super.handleOnConfigurationChanged(config);
        if (previewing) getActivity().runOnUiThread(() -> WindowCompat.getInsetsController(getActivity().getWindow(), getActivity().getWindow().getDecorView()).hide(WindowInsetsCompat.Type.systemBars()));
    }

    @PluginMethod
    public void exit(PluginCall call) { call.resolve(); getActivity().runOnUiThread(() -> getActivity().finish()); }

    private void cleanup(boolean delete) {
        if (stream != null) { try { stream.close(); } catch (Exception ignored) {} }
        if (delete && uri != null) { try { DocumentsContract.deleteDocument(getContext().getContentResolver(), uri); } catch (Exception ignored) {} }
        stream = null; uri = null; token = null; written = 0;
    }

    @Override
    protected synchronized void handleOnDestroy() { cleanup(true); super.handleOnDestroy(); }
}
