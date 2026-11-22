package io.github.codeofstalker;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.SystemBarStyle;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The whole app is the web export inside the APK, shown in one WebView at the fixed
 * secure origin https://appassets.androidplatform.net (WebViewAssetLoader). The origin
 * must never change: the diary (IndexedDB) belongs to package + signing key + origin.
 * Nothing here draws: the page owns all graphics; this class only bridges the platform
 * (system bars, back, microphone permission, file picker, «save as»).
 */
public final class MainActivity extends ComponentActivity {
    static final String HOST = WebViewAssetLoader.DEFAULT_DOMAIN;
    static final String ORIGIN = "https://" + HOST;
    private static final String BRIDGE = "CodeOfStalkerAndroid";
    private static final String BACK =
        "(function(){if(typeof window.watcherAndroidBack!=='function')return 'none';window.watcherAndroidBack();return 'ok';})()";

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final ActivityResultLauncher<String> micPermission =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), this::onMicPermission);
    private final ActivityResultLauncher<Intent> openDocument =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), this::onDocumentChosen);
    private final ActivityResultLauncher<Intent> createDocument =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), this::onDocumentCreated);

    private SharedPreferences prefs;
    private WebViewAssetLoader loader;
    private FrameLayout root;
    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private PermissionRequest micRequest;
    private PendingSave save;

    /** A backup file arriving from the page in chunks, then waiting for the «save as» dialog. */
    private static final class PendingSave {
        final String id, name, mime;
        final File file;
        final JavaScriptReplyProxy reply;
        OutputStream out;

        PendingSave(String id, String name, String mime, File file, OutputStream out, JavaScriptReplyProxy reply) {
            this.id = id; this.name = name; this.mime = mime; this.file = file; this.out = out; this.reply = reply;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        prefs = getSharedPreferences("shell", MODE_PRIVATE);
        clearExports();
        loader = new WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/", new WebExport(getAssets()))
            .build();
        root = new FrameLayout(this);
        // The page never sits under the status/navigation bars or the keyboard: the
        // bars show the theme's page color behind them instead.
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets edges = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            view.setPadding(edges.left, edges.top, edges.right, edges.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        applyTheme(prefs.getInt("background", Color.BLACK), prefs.getBoolean("light", false));
        configure(web);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                goBack();
            }
        });
        web.loadUrl(ORIGIN + "/");
    }

    private void configure(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setGeolocationEnabled(false);
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable || getResources().getBoolean(R.bool.watcher_web_debug));

        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) return false;
                openOutside(url);
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The page's renderer is gone (memory pressure or a crash): start over.
                if (view == web) {
                    root.removeView(web);
                    web.destroy();
                    web = null;
                    recreate();
                }
                return true;
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                Uri origin = request.getOrigin();
                boolean ours = origin != null && "https".equals(origin.getScheme()) && HOST.equals(origin.getHost());
                String[] resources = request.getResources();
                boolean microphoneOnly = resources.length > 0;
                for (String resource : resources) microphoneOnly &= PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource);
                if (!ours || !microphoneOnly) {
                    request.deny();
                    return;
                }
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    return;
                }
                if (micRequest != null) micRequest.deny();
                micRequest = request;
                micPermission.launch(Manifest.permission.RECORD_AUDIO);
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (request == micRequest) micRequest = null;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = callback;
                // `.watcherbackup` has no registered MIME type: offer every file.
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*");
                try {
                    openDocument.launch(intent);
                } catch (ActivityNotFoundException missing) {
                    chooser = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, R.string.no_file_picker, Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(view, BRIDGE, Collections.singleton(ORIGIN), this::onPageMessage);
        }
    }

    private void goBack() {
        if (web == null) {
            moveTaskToBack(true);
            return;
        }
        // The page decides: close the open window, take its own back step, or ask to leave.
        web.evaluateJavascript(BACK, value -> {
            if ("\"ok\"".equals(value)) return;
            if (web != null && web.canGoBack()) web.goBack();
            else moveTaskToBack(true);
        });
    }

    private void onPageMessage(@NonNull WebView view, @NonNull WebMessageCompat message, @NonNull Uri sourceOrigin,
                               boolean isMainFrame, @NonNull JavaScriptReplyProxy reply) {
        if (!isMainFrame || !"https".equals(sourceOrigin.getScheme()) || !HOST.equals(sourceOrigin.getHost())) return;
        JSONObject data;
        try {
            String text = message.getData();
            if (text == null) return;
            data = new JSONObject(text);
        } catch (JSONException | RuntimeException invalid) {
            return;
        }
        switch (data.optString("type")) {
            case "theme":
                onTheme(data);
                break;
            case "exit":
                moveTaskToBack(true);
                break;
            case "save-begin":
                beginSave(data, reply);
                break;
            case "save-chunk":
                saveChunk(data, reply);
                break;
            case "save-end":
                endSave(data, reply);
                break;
            default:
                break;
        }
    }

    private void onTheme(JSONObject data) {
        int color;
        try {
            color = Color.parseColor(data.optString("background", "#000000"));
        } catch (IllegalArgumentException invalid) {
            return;
        }
        boolean light = data.optBoolean("light", false);
        prefs.edit().putInt("background", color).putBoolean("light", light).apply();
        applyTheme(color, light);
    }

    private void applyTheme(int color, boolean light) {
        getWindow().setBackgroundDrawable(new ColorDrawable(color));
        root.setBackgroundColor(color);
        if (web != null) web.setBackgroundColor(color);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(light);
        bars.setAppearanceLightNavigationBars(light);
    }

    private void openOutside(Uri url) {
        String scheme = url.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme) && !"mailto".equals(scheme) && !"tel".equals(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException missing) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_LONG).show();
        }
    }

    private void onMicPermission(Boolean granted) {
        PermissionRequest request = micRequest;
        micRequest = null;
        if (request == null) return;
        if (Boolean.TRUE.equals(granted)) request.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else request.deny();
    }

    private void onDocumentChosen(ActivityResult result) {
        ValueCallback<Uri[]> callback = chooser;
        chooser = null;
        if (callback == null) return;
        Intent data = result.getData();
        Uri uri = result.getResultCode() == RESULT_OK && data != null ? data.getData() : null;
        callback.onReceiveValue(uri == null ? null : new Uri[] {uri});
    }

    // «Save as» for the backup file. The page sends it in acknowledged chunks, so only
    // one chunk is ever in flight; the file waits in the cache until the person picks a place.

    private void beginSave(JSONObject data, JavaScriptReplyProxy reply) {
        abandonSave();
        String id = data.optString("id");
        String name = data.optString("name", "").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-");
        if (name.isEmpty()) name = "watcher.watcherbackup";
        String mime = data.optString("mime", "application/octet-stream");
        try {
            File directory = exportsDirectory();
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("no cache directory");
            File file = File.createTempFile("save", ".part", directory);
            save = new PendingSave(id, name, mime, file, new BufferedOutputStream(new FileOutputStream(file), 1 << 20), reply);
            send(reply, "save-ack", id, null);
        } catch (IOException failed) {
            send(reply, "save-result", id, "failed");
        }
    }

    private void saveChunk(JSONObject data, JavaScriptReplyProxy reply) {
        String id = data.optString("id");
        PendingSave current = save;
        if (current == null || current.out == null || !current.id.equals(id)) {
            send(reply, "save-result", id, "failed");
            return;
        }
        try {
            current.out.write(Base64.decode(data.optString("data"), Base64.DEFAULT));
            send(reply, "save-ack", id, null);
        } catch (IOException | IllegalArgumentException failed) {
            abandonSave();
            send(reply, "save-result", id, "failed");
        }
    }

    private void endSave(JSONObject data, JavaScriptReplyProxy reply) {
        String id = data.optString("id");
        PendingSave current = save;
        if (current == null || current.out == null || !current.id.equals(id)) {
            send(reply, "save-result", id, "failed");
            return;
        }
        try {
            current.out.close();
            current.out = null;
            createDocument.launch(new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(current.mime)
                .putExtra(Intent.EXTRA_TITLE, current.name));
        } catch (IOException | ActivityNotFoundException failed) {
            abandonSave();
            send(reply, "save-result", id, "failed");
        }
    }

    private void onDocumentCreated(ActivityResult result) {
        PendingSave current = save;
        if (current == null || current.out != null) return;
        Intent data = result.getData();
        Uri target = result.getResultCode() == RESULT_OK && data != null ? data.getData() : null;
        if (target == null) {
            save = null;
            deleteQuietly(current.file);
            send(current.reply, "save-result", current.id, "cancelled");
            return;
        }
        io.execute(() -> {
            boolean saved = false;
            try (InputStream in = new FileInputStream(current.file);
                 OutputStream out = getContentResolver().openOutputStream(target, "w")) {
                if (out != null) {
                    byte[] buffer = new byte[1 << 16];
                    for (int read; (read = in.read(buffer)) > 0; ) out.write(buffer, 0, read);
                    saved = true;
                }
            } catch (IOException | SecurityException failed) {
                saved = false;
            }
            deleteQuietly(current.file);
            boolean ok = saved;
            runOnUiThread(() -> {
                if (save == current) save = null;
                send(current.reply, "save-result", current.id, ok ? "saved" : "failed");
            });
        });
    }

    private void abandonSave() {
        PendingSave current = save;
        save = null;
        if (current == null) return;
        if (current.out != null) {
            try {
                current.out.close();
            } catch (IOException ignored) {
                // The temporary file is deleted next anyway.
            }
        }
        deleteQuietly(current.file);
    }

    private File exportsDirectory() {
        return new File(getCacheDir(), "exports");
    }

    private void clearExports() {
        File[] files = exportsDirectory().listFiles();
        if (files != null) for (File file : files) deleteQuietly(file);
    }

    private static void deleteQuietly(File file) {
        if (file != null && file.exists() && !file.delete()) file.deleteOnExit();
    }

    private static void send(JavaScriptReplyProxy reply, String type, String id, String result) {
        try {
            JSONObject message = new JSONObject().put("type", type).put("id", id);
            if (result != null) message.put("result", result);
            reply.postMessage(message.toString());
        } catch (JSONException | RuntimeException gone) {
            // The page that asked has gone (reload or a new page); nothing to tell.
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        abandonSave();
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        io.shutdown();
        super.onDestroy();
    }
}
