package io.github.codeofstalker;

import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.WorkerThread;
import androidx.webkit.WebViewAssetLoader;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Serves the prepared web export (APK assets under {@code www/}) the way GitHub Pages
 * serves the site: files by path, and every route without a file extension
 * ({@code /home}, {@code /diary}, ...) gets {@code index.html}, the SPA shell.
 * A missing file with an extension is a plain 404, never the shell.
 */
final class WebExport implements WebViewAssetLoader.PathHandler {
    private static final String ROOT = "www/";
    private static final Map<String, String> TYPES = new HashMap<>();
    static {
        TYPES.put("html", "text/html");
        TYPES.put("js", "text/javascript");
        TYPES.put("mjs", "text/javascript");
        TYPES.put("css", "text/css");
        TYPES.put("json", "application/json");
        TYPES.put("map", "application/json");
        TYPES.put("webmanifest", "application/manifest+json");
        TYPES.put("wasm", "application/wasm");
        TYPES.put("bin", "application/octet-stream");
        TYPES.put("z", "application/octet-stream");
        TYPES.put("png", "image/png");
        TYPES.put("jpg", "image/jpeg");
        TYPES.put("jpeg", "image/jpeg");
        TYPES.put("webp", "image/webp");
        TYPES.put("gif", "image/gif");
        TYPES.put("avif", "image/avif");
        TYPES.put("svg", "image/svg+xml");
        TYPES.put("ico", "image/x-icon");
        TYPES.put("ttf", "font/ttf");
        TYPES.put("otf", "font/otf");
        TYPES.put("woff", "font/woff");
        TYPES.put("woff2", "font/woff2");
        TYPES.put("txt", "text/plain");
        TYPES.put("mp3", "audio/mpeg");
        TYPES.put("m4a", "audio/mp4");
        TYPES.put("ogg", "audio/ogg");
        TYPES.put("wav", "audio/wav");
        TYPES.put("mp4", "video/mp4");
        TYPES.put("webm", "video/webm");
    }

    private final AssetManager assets;

    WebExport(@NonNull AssetManager assets) {
        this.assets = assets;
    }

    @Override
    @WorkerThread
    @Nullable
    public WebResourceResponse handle(@NonNull String path) {
        String clean = path;
        int cut = indexOfAny(clean, '?', '#');
        if (cut >= 0) clean = clean.substring(0, cut);
        while (clean.startsWith("/")) clean = clean.substring(1);
        if (clean.contains("..") || clean.contains("\\")) return notFound();
        String name = clean.substring(clean.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        if (clean.isEmpty() || dot < 0) return open("index.html", "html");
        return open(clean, name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    private WebResourceResponse open(String file, String extension) {
        try {
            InputStream stream = assets.open(ROOT + file, AssetManager.ACCESS_STREAMING);
            String type = TYPES.get(extension);
            if (type == null) type = "application/octet-stream";
            String charset = type.startsWith("text/") || type.endsWith("json") || type.endsWith("+xml") ? "utf-8" : null;
            WebResourceResponse response = new WebResourceResponse(type, charset, stream);
            Map<String, String> headers = new HashMap<>();
            // Scene files keep their names across releases, so nothing may outlive the APK
            // that served it; reading from the APK is as fast as any cache.
            headers.put("Cache-Control", "no-cache");
            headers.put("X-Content-Type-Options", "nosniff");
            response.setResponseHeaders(headers);
            return response;
        } catch (FileNotFoundException missing) {
            return notFound();
        } catch (IOException failed) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        WebResourceResponse response = new WebResourceResponse("text/plain", "utf-8", null);
        response.setStatusCodeAndReasonPhrase(404, "Not Found");
        return response;
    }

    private static int indexOfAny(String text, char a, char b) {
        int x = text.indexOf(a), y = text.indexOf(b);
        if (x < 0) return y;
        if (y < 0) return x;
        return Math.min(x, y);
    }
}
