package sg.kithandkeen.ordo;

import android.app.Activity;
import android.content.Intent;
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

    @PluginMethod
    public synchronized void beginSave(PluginCall call) {
        if (stream != null || selecting) { call.reject("Another file save is already active."); return; }
        String name = call.getString("name");
        Long size = call.getLong("size");
        if (name == null || name.trim().isEmpty() || size == null || size < 0 || size > 268435456L) {
            call.reject("Invalid file name or file exceeds the initial 256 MB save limit."); return;
        }
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
            String data = call.getString("data"); Long offset = call.getLong("offset");
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
    public void exit(PluginCall call) { call.resolve(); getActivity().runOnUiThread(() -> getActivity().finish()); }

    private void cleanup(boolean delete) {
        if (stream != null) { try { stream.close(); } catch (Exception ignored) {} }
        if (delete && uri != null) { try { DocumentsContract.deleteDocument(getContext().getContentResolver(), uri); } catch (Exception ignored) {} }
        stream = null; uri = null; token = null; written = 0;
    }

    @Override
    protected synchronized void handleOnDestroy() { cleanup(true); super.handleOnDestroy(); }
}
