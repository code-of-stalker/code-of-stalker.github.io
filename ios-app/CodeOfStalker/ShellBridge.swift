import UIKit
import WebKit

/// The page side lives in src/features/product/platform/androidApp.ts. The shell gives the
/// page `window.CodeOfStalkerIOS`, a port with the same messages as Android's
/// `CodeOfStalkerAndroid`: `theme`, `exit` (ignored: an iOS app never quits itself) and
/// the acknowledged `save-begin` / `save-chunk` / `save-end` chunks of a backup file.
/// Every reply is a JSON string the port hands to the page's message listeners.
@MainActor
protocol ShellHost: AnyObject {
    func applyTheme(background: UIColor, light: Bool)
    /// Shows the Files export sheet for a finished file; `done(true)` once it is stored.
    func exportFile(_ url: URL, done: @escaping (Bool) -> Void)
}

@MainActor
final class ShellBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let name = "codeOfStalker"

    /// Injected at document start into our main frame only. User scripts are not subject
    /// to the page's Content-Security-Policy.
    static let pageScript = """
    (() => {
      const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.\(name);
      if (!handler || window.CodeOfStalkerIOS) return;
      const listeners = new Set();
      const deliver = data => { for (const listener of [...listeners]) { try { listener({ data }); } catch (error) { setTimeout(() => { throw error; }); } } };
      Object.defineProperty(window, 'CodeOfStalkerIOS', { value: Object.freeze({
        postMessage(message) { Promise.resolve(handler.postMessage(String(message))).then(reply => { if (typeof reply === 'string') deliver(reply); }, () => {}); },
        addEventListener(type, listener) { if (type === 'message' && typeof listener === 'function') listeners.add(listener); },
        removeEventListener(type, listener) { listeners.delete(listener); },
      }) });
    })();
    """

    /// 2 GiB: far above any diary backup, small enough to refuse a runaway page.
    private static let largestFile = 2 << 30

    private struct Save {
        let folder: URL
        let file: URL
        let handle: FileHandle
        let size: Int
        var written: Int
    }

    weak var host: ShellHost?
    private var saves: [String: Save] = [:]
    /// Test builds keep a copy of each saved file (Harness); nil otherwise.
    var onSaved: ((URL) -> Void)?

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == WebViewController.scheme, origin.host == WebViewController.host,
              let text = message.body as? String, let data = text.data(using: .utf8),
              let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], let type = body["type"] as? String
        else { replyHandler(nil, nil); return }
        switch type {
        case "theme":
            if let background = (body["background"] as? String).flatMap(Self.color) {
                host?.applyTheme(background: background, light: body["light"] as? Bool ?? false)
            }
            replyHandler(nil, nil)
        case "save-begin":
            replyHandler(begin(body), nil)
        case "save-chunk":
            replyHandler(chunk(body), nil)
        case "save-end":
            end(body) { replyHandler($0, nil) }
        default:
            replyHandler(nil, nil)
        }
    }

    // MARK: Saving a file

    private func reply(_ type: String, _ id: String, result: String? = nil) -> String {
        var object = ["type": type, "id": id]
        if let result { object["result"] = result }
        let data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data()
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    private func begin(_ body: [String: Any]) -> String? {
        guard let id = body["id"] as? String, !id.isEmpty, id.count <= 80 else { return nil }
        let size = (body["size"] as? NSNumber)?.intValue ?? -1
        guard size >= 0, size <= Self.largestFile else { return reply("save-result", id, result: "failed") }
        discard(id)
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("export", isDirectory: true)
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent(Self.safeName(body["name"] as? String ?? ""))
            guard FileManager.default.createFile(atPath: file.path, contents: nil) else { throw CocoaError(.fileWriteUnknown) }
            saves[id] = Save(folder: folder, file: file, handle: try FileHandle(forWritingTo: file), size: size, written: 0)
            return reply("save-ack", id)
        } catch {
            return reply("save-result", id, result: "failed")
        }
    }

    private func chunk(_ body: [String: Any]) -> String? {
        guard let id = body["id"] as? String, var save = saves[id] else { return nil }
        guard let text = body["data"] as? String, let bytes = Data(base64Encoded: text), save.written + bytes.count <= save.size else {
            discard(id)
            return reply("save-result", id, result: "failed")
        }
        do {
            try save.handle.write(contentsOf: bytes)
            save.written += bytes.count
            saves[id] = save
            return reply("save-ack", id)
        } catch {
            discard(id)
            return reply("save-result", id, result: "failed")
        }
    }

    private func end(_ body: [String: Any], answer: @escaping (String?) -> Void) {
        guard let id = body["id"] as? String, let save = saves.removeValue(forKey: id) else { answer(nil); return }
        do { try save.handle.close() } catch {
            try? FileManager.default.removeItem(at: save.folder)
            answer(reply("save-result", id, result: "failed"))
            return
        }
        guard save.written == save.size, let host else {
            try? FileManager.default.removeItem(at: save.folder)
            answer(reply("save-result", id, result: "failed"))
            return
        }
        onSaved?(save.file)
        host.exportFile(save.file) { [weak self] stored in
            try? FileManager.default.removeItem(at: save.folder)
            answer(self?.reply("save-result", id, result: stored ? "saved" : "cancelled"))
        }
    }

    private func discard(_ id: String) {
        guard let save = saves.removeValue(forKey: id) else { return }
        try? save.handle.close()
        try? FileManager.default.removeItem(at: save.folder)
    }

    // MARK: Helpers

    /// Letters, digits, dot, dash and underscore only; never a path.
    nonisolated static func safeName(_ raw: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
        let mapped = String(String.UnicodeScalarView(raw.unicodeScalars.map { allowed.contains($0) ? $0 : "_" }))
        let trimmed = mapped.trimmingCharacters(in: CharacterSet(charactersIn: "._"))
        return trimmed.isEmpty ? "backup.watcherbackup" : String(trimmed.prefix(120))
    }

    /// `#rgb`, `#rrggbb` or `#rrggbbaa`.
    nonisolated static func color(_ text: String) -> UIColor? {
        var hex = text.trimmingCharacters(in: .whitespaces)
        guard hex.hasPrefix("#") else { return nil }
        hex.removeFirst()
        if hex.count == 3 { hex = hex.map { "\($0)\($0)" }.joined() }
        guard hex.count == 6 || hex.count == 8, let value = UInt64(hex, radix: 16) else { return nil }
        let rgba = hex.count == 6 ? value << 8 | 0xff : value
        return UIColor(red: CGFloat(rgba >> 24 & 0xff) / 255, green: CGFloat(rgba >> 16 & 0xff) / 255,
                       blue: CGFloat(rgba >> 8 & 0xff) / 255, alpha: CGFloat(rgba & 0xff) / 255)
    }
}
