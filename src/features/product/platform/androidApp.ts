import { useEffect } from 'react';

/**
 * Bridge to the app shells. The Android shell (`android-app/`) serves this same web
 * export from the APK and injects `CodeOfStalkerAndroid` into our origin's main frame
 * only (WebViewCompat.addWebMessageListener). The iOS shell (`ios-app/`) serves it from
 * the app bundle and injects `CodeOfStalkerIOS`, a port with the same messages over
 * WebKit's script message handler. On the site neither object exists, so every function
 * here is a no-op and the site behaves exactly as before.
 */
type ShellMessage = { data: unknown };
type ShellPort = {
  postMessage(message: string): void;
  addEventListener?(type: 'message', listener: (event: ShellMessage) => void): void;
  removeEventListener?(type: 'message', listener: (event: ShellMessage) => void): void;
};

type ShellWindow = { CodeOfStalkerAndroid?: ShellPort; CodeOfStalkerIOS?: ShellPort };
const usable = (port: ShellPort | undefined) => port && typeof port.postMessage === 'function' ? port : null;
const android = () => typeof window === 'undefined' ? null : usable((window as unknown as ShellWindow).CodeOfStalkerAndroid);

function shell(): ShellPort | null {
  if (typeof window === 'undefined') return null;
  return android() ?? usable((window as unknown as ShellWindow).CodeOfStalkerIOS);
}

/** Android only: its system back and leaving the app have no iOS counterpart. */
export function isAndroidApp(): boolean { return android() !== null; }

/** Inside either app shell, where files are saved through the system picker. */
export function isAppShell(): boolean { return shell() !== null; }

function post(message: Record<string, unknown>) { shell()?.postMessage(JSON.stringify(message)); }

/** The shell leaves the app (to the launcher), as Android's own back does on a root screen. */
export function exitAndroidApp() { post({ type: 'exit' }); }

/** System bars and the window behind the page follow the theme's page color. */
export function useAndroidSystemBars(background: string, light: boolean) {
  useEffect(() => { post({ type: 'theme', background, light }); }, [background, light]);
}

/** The shell calls `window.watcherAndroidBack()` for the system back gesture/button. */
export function useAndroidBack(handler: () => void) {
  useEffect(() => {
    if (!isAndroidApp()) return;
    const target = window as unknown as { watcherAndroidBack?: () => void };
    const run = () => handler();
    target.watcherAndroidBack = run;
    return () => { if (target.watcherAndroidBack === run) delete target.watcherAndroidBack; };
  }, [handler]);
}

// 384 KiB of bytes per message: 512 KiB of base64, well under WebView's message limits.
const CHUNK = 384 * 1024;

function base64(bytes: Uint8Array) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/**
 * Save bytes through the system's own «save as» picker: Android's Storage Access
 * Framework, or the Files export sheet on iOS. A web view cannot download blob: links,
 * so the file goes to the shell in acknowledged chunks, which keeps memory bounded for
 * large backups. Resolves true when the file was written, false when the person cancelled.
 */
export function saveFileInApp(bytes: Uint8Array, name: string, mime: string): Promise<boolean> {
  const port = shell();
  if (!port?.addEventListener || !port.removeEventListener) return Promise.reject(new Error('App shell is not available.'));
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return new Promise<boolean>((resolve, reject) => {
    let offset = 0;
    const finish = (result: () => void) => { port.removeEventListener!('message', listen); result(); };
    const next = () => {
      if (offset >= bytes.length) { post({ type: 'save-end', id }); return; }
      const end = Math.min(bytes.length, offset + CHUNK);
      post({ type: 'save-chunk', id, data: base64(bytes.subarray(offset, end)) });
      offset = end;
    };
    function listen(event: ShellMessage) {
      let reply: { type?: string; id?: string; result?: string };
      try { reply = JSON.parse(String(event.data)); } catch { return; }
      if (reply.id !== id) return;
      if (reply.type === 'save-ack') next();
      else if (reply.type === 'save-result') {
        if (reply.result === 'saved') finish(() => resolve(true));
        else if (reply.result === 'cancelled') finish(() => resolve(false));
        else finish(() => reject(new Error('Не удалось сохранить файл. Попробуй ещё раз.')));
      }
    }
    port.addEventListener!('message', listen);
    post({ type: 'save-begin', id, name, mime, size: bytes.length });
  });
}
