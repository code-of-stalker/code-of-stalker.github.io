#if HARNESS
import UIKit
import WebKit

/// Test builds only (compile flag HARNESS, launch argument `-harness`): lets
/// ios-app/harness/ drive the app in the iOS Simulator without a Mac at hand.
///
/// The host writes `Documents/harness/in/<id>.json` = `{"id", "op", "body"}`; the app answers
/// in `Documents/harness/out/<id>.json`. Page errors, outside requests and missing files go
/// to `Documents/harness/events.log`, one JSON object per line. With `-harnessOffline` a
/// content rule list blocks every http(s) and ws(s) load before the first page starts.
@MainActor
final class Harness: NSObject, WKScriptMessageHandler {
    static var enabled: Bool { ProcessInfo.processInfo.arguments.contains("-harness") }
    static var offline: Bool { ProcessInfo.processInfo.arguments.contains("-harnessOffline") }

    private static let eventsScript = """
    (() => {
      const handler = window.webkit.messageHandlers.harnessEvents;
      const send = (kind, text) => { try { handler.postMessage(JSON.stringify({ kind, text: String(text).slice(0, 4000), path: location.pathname })); } catch {} };
      const show = value => { try { return value instanceof Error ? (value.stack || value.message) : typeof value === 'object' ? JSON.stringify(value) : String(value); } catch { return String(value); } };
      for (const level of ['error', 'warn']) {
        const original = console[level];
        console[level] = function (...args) { send('console.' + level, args.map(show).join(' ')); return original.apply(this, args); };
      }
      addEventListener('error', event => {
        if (event.target && event.target !== window) send('resource-error', event.target.src || event.target.href || event.target.tagName);
        else send('error', `${event.message} @ ${event.filename}:${event.lineno}:${event.colno} ${event.error ? show(event.error) : ''}`);
      }, true);
      addEventListener('unhandledrejection', event => send('unhandledrejection', show(event.reason)));
      addEventListener('securitypolicyviolation', event => send('csp', `${event.violatedDirective} ${event.blockedURI}`));
      const outside = url => {
        try {
          const target = new URL(url, location.href);
          if (['blob:', 'data:', 'about:', 'javascript:'].includes(target.protocol)) return false;
          return target.protocol !== location.protocol || target.host !== location.host;
        } catch { return false; }
      };
      const fetch0 = window.fetch;
      window.fetch = function (input, init) { const url = typeof input === 'string' ? input : input && input.url; if (outside(url)) send('outside', 'fetch ' + url); return fetch0.apply(this, arguments); };
      const open0 = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) { if (outside(url)) send('outside', 'xhr ' + url); return open0.apply(this, arguments); };
      // WebKit throws at once when the page CSP refuses a socket. The development build's
      // reload client opens one at start, and the throw stops the whole bundle; a closed
      // stand-in socket lets the demo build start, as a refused connection would elsewhere.
      const refused = url => {
        const socket = new EventTarget();
        Object.assign(socket, { url: String(url), readyState: 3, protocol: '', extensions: '', bufferedAmount: 0, binaryType: 'blob', send() {}, close() {} });
        setTimeout(() => {
          const error = new Event('error'), close = new CloseEvent('close', { code: 1006, wasClean: false });
          if (typeof socket.onerror === 'function') socket.onerror(error);
          socket.dispatchEvent(error);
          if (typeof socket.onclose === 'function') socket.onclose(close);
          socket.dispatchEvent(close);
        }, 0);
        return socket;
      };
      if (window.WebSocket) window.WebSocket = new Proxy(window.WebSocket, { construct(target, args) {
        send('outside', 'ws ' + args[0]);
        try { return Reflect.construct(target, args); } catch (error) { send('ws-refused', args[0] + ' ' + (error && error.name)); return refused(args[0]); }
      } });
      if (window.EventSource) window.EventSource = new Proxy(window.EventSource, { construct(target, args) { send('outside', 'sse ' + args[0]); return Reflect.construct(target, args); } });
      try { new PerformanceObserver(list => { for (const entry of list.getEntries()) if (outside(entry.name)) send('outside', 'resource ' + entry.name); }).observe({ type: 'resource', buffered: true }); } catch {}
    })();
    """

    /// `-harnessNoGpu`: the page sees no WebGL and no WebGPU. The GitHub Mac's simulator GPU
    /// runs out of memory under the scenes and then WebKit stops painting the whole page, so
    /// the screen checks run without scenes and a separate pass records what graphics do.
    private static let noGpuScript = """
    (() => {
      const handler = window.webkit.messageHandlers.harnessEvents;
      const hidden = new Set();
      const note = type => { if (hidden.has(type)) return; hidden.add(type); try { handler.postMessage(JSON.stringify({ kind: 'gpu-hidden', text: type, path: location.pathname })); } catch {} };
      for (const Canvas of [window.HTMLCanvasElement, window.OffscreenCanvas].filter(Boolean)) {
        const original = Canvas.prototype.getContext;
        Canvas.prototype.getContext = function (type, ...rest) {
          if (/^(webgl2?|experimental-webgl|webgpu)$/.test(String(type))) { note(String(type)); return null; }
          return original.call(this, type, ...rest);
        };
      }
      try { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true }); } catch {}
      try { if (navigator.gpu) Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); } catch {}
      if (navigator.gpu) note('webgpu-still-visible');
    })();
    """

    static var noGpu: Bool { ProcessInfo.processInfo.arguments.contains("-harnessNoGpu") }

    private static let offlineRules = """
    [{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}},
     {"trigger":{"url-filter":"^wss?://"},"action":{"type":"block"}}]
    """

    private weak var controller: WebViewController?
    private let folder: URL
    private let inbox: URL
    private let outbox: URL
    private let saved: URL
    private let log: URL
    private var timer: Timer?
    private var running = Set<String>()

    init(controller: WebViewController) {
        self.controller = controller
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        folder = documents.appendingPathComponent("harness", isDirectory: true)
        inbox = folder.appendingPathComponent("in", isDirectory: true)
        outbox = folder.appendingPathComponent("out", isDirectory: true)
        saved = folder.appendingPathComponent("saved", isDirectory: true)
        log = folder.appendingPathComponent("events.log")
        super.init()
        for url in [inbox, outbox, saved] { try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true) }
    }

    /// Hooks the page, fences the network when asked, then calls `start` to load the app.
    func prepare(_ start: @escaping () -> Void) {
        guard let webView = controller?.webView else { return }
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        let content = webView.configuration.userContentController
        content.addUserScript(WKUserScript(source: Self.eventsScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if Self.noGpu { content.addUserScript(WKUserScript(source: Self.noGpuScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        content.add(self, contentWorld: .page, name: "harnessEvents")
        event("launch", ProcessInfo.processInfo.arguments.joined(separator: " "))
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.poll() }
        }
        guard Self.offline else { start(); return }
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "harness-offline", encodedContentRuleList: Self.offlineRules) { [weak self] list, error in
            if let list { content.add(list); self?.event("offline", "network fenced") } else { self?.event("offline-failed", String(describing: error)) }
            start()
        }
    }

    // MARK: Records

    func event(_ kind: String, _ text: String) {
        append(["kind": kind, "text": text])
    }

    func keepSaved(_ file: URL) {
        let copy = saved.appendingPathComponent(file.lastPathComponent)
        try? FileManager.default.removeItem(at: copy)
        do { try FileManager.default.copyItem(at: file, to: copy); event("saved", copy.lastPathComponent) } catch { event("saved-failed", String(describing: error)) }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let text = message.body as? String, let data = text.data(using: .utf8),
              let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        append(object)
    }

    private func append(_ object: [String: Any]) {
        var line = object
        line["at"] = Date().timeIntervalSince1970
        guard var data = try? JSONSerialization.data(withJSONObject: line) else { return }
        data.append(0x0a)
        if let handle = try? FileHandle(forWritingTo: log) {
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
            try? handle.close()
        } else {
            try? data.write(to: log)
        }
    }

    // MARK: Commands

    private func poll() {
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: inbox.path) else { return }
        for name in names.sorted() where name.hasSuffix(".json") && !running.contains(name) {
            let file = inbox.appendingPathComponent(name)
            guard let data = try? Data(contentsOf: file),
                  let command = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let id = command["id"] as? String else { continue }
            running.insert(name)
            try? FileManager.default.removeItem(at: file)
            run(command["op"] as? String ?? "", command["body"]) { [weak self] answer in
                guard let self else { return }
                var reply = answer
                reply["id"] = id
                let out = self.outbox.appendingPathComponent("\(id).json")
                if let json = try? JSONSerialization.data(withJSONObject: reply) { try? json.write(to: out, options: .atomic) }
                self.running.remove(name)
            }
        }
    }

    private func run(_ op: String, _ body: Any?, answer: @escaping ([String: Any]) -> Void) {
        guard let controller, let webView = controller.webView else { answer(["ok": false, "error": "no web view"]); return }
        switch op {
        case "js":
            webView.callAsyncJavaScript(body as? String ?? "", arguments: [:], in: nil, in: .page) { result in
                switch result {
                case .success(let value):
                    if let text = value as? String { answer(["ok": true, "value": text]) }
                    else if JSONSerialization.isValidJSONObject(["value": value]) { answer(["ok": true, "value": value]) }
                    else { answer(["ok": true, "value": String(describing: value)]) }
                case .failure(let error):
                    answer(["ok": false, "error": Self.describe(error)])
                }
            }
        case "reload":
            webView.reload()
            answer(["ok": true])
        case "load":
            let path = body as? String ?? "/"
            guard let url = URL(string: path, relativeTo: WebViewController.start) else { answer(["ok": false, "error": "bad path"]); return }
            webView.load(URLRequest(url: url))
            answer(["ok": true])
        case "native":
            answer(["ok": true, "value": native(controller, webView)])
        case "dismiss":
            // Closes the Files export sheet as if a folder had been picked (or cancelled).
            guard let picker = controller.presentedViewController as? UIDocumentPickerViewController else {
                answer(["ok": false, "error": "no picker: \(String(describing: controller.presentedViewController.map { type(of: $0) }))"])
                return
            }
            let stored = (body as? String) == "saved"
            picker.dismiss(animated: true) {
                controller.finishExport(stored)
                answer(["ok": true, "value": stored ? "saved" : "cancelled"])
            }
        default:
            answer(["ok": false, "error": "unknown op \(op)"])
        }
    }

    private func native(_ controller: WebViewController, _ webView: WKWebView) -> [String: Any] {
        let insets = controller.view.safeAreaInsets
        return [
            "presented": controller.presentedViewController.map { String(describing: type(of: $0)) } ?? "",
            "statusBarLight": controller.statusBarIsLight,
            "background": Self.hex(controller.pageBackgroundColor),
            "windowBackground": Self.hex(controller.view.window?.backgroundColor ?? .clear),
            "safeArea": [insets.top, insets.left, insets.bottom, insets.right].map { Double($0) },
            "webFrame": [webView.frame.minX, webView.frame.minY, webView.frame.width, webView.frame.height].map { Double($0) },
            "screen": [Double(controller.view.bounds.width), Double(controller.view.bounds.height), Double(UIScreen.main.scale)],
            "url": webView.url?.absoluteString ?? "",
            "pinch": webView.scrollView.pinchGestureRecognizer?.isEnabled ?? false,
            "backGestures": webView.allowsBackForwardNavigationGestures,
            "system": "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion) \(UIDevice.current.model)",
        ]
    }

    private static func describe(_ error: Error) -> String {
        let ns = error as NSError
        let message = ns.userInfo["WKJavaScriptExceptionMessage"] as? String
        return message.map { "\($0) (\(ns.domain) \(ns.code))" } ?? "\(ns.domain) \(ns.code) \(ns.localizedDescription)"
    }

    private static func hex(_ color: UIColor) -> String {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return "?" }
        return String(format: "#%02X%02X%02X%02X", Int(red * 255), Int(green * 255), Int(blue * 255), Int(alpha * 255))
    }
}
#endif
