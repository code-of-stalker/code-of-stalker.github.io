import Foundation
import WebKit

/// Serves the web export inside the app bundle at `codeofstalker://localhost/`.
///
/// Mirrors android-app's WebExport: an extensionless path (`/home`, `/diary`, ...) gets
/// `index.html`, the single-page shell; a missing file with an extension is a plain 404,
/// never the shell. Every file is already on the device, so nothing is cached.
@MainActor
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    private static let types: [String: String] = [
        "html": "text/html", "js": "text/javascript", "mjs": "text/javascript", "css": "text/css",
        "json": "application/json", "map": "application/json", "webmanifest": "application/manifest+json",
        "wasm": "application/wasm", "bin": "application/octet-stream", "z": "application/octet-stream",
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif",
        "avif": "image/avif", "svg": "image/svg+xml", "ico": "image/x-icon",
        "ttf": "font/ttf", "otf": "font/otf", "woff": "font/woff", "woff2": "font/woff2", "txt": "text/plain",
        "mp3": "audio/mpeg", "m4a": "audio/mp4", "ogg": "audio/ogg", "wav": "audio/wav",
        "mp4": "video/mp4", "webm": "video/webm",
    ]

    private let root: URL
    private let reader = DispatchQueue(label: "code.of.stalker.web-export", qos: .userInitiated, attributes: .concurrent)
    /// Tasks WebKit stopped while their file was being read; they must get no more calls.
    private var stopped = Set<ObjectIdentifier>()
    /// Test builds report missing files (Harness); nil otherwise.
    var onMissing: ((String) -> Void)?

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    /// The bundle file for a request path, or nil for a 404. Pure, so it is testable.
    nonisolated static func file(for requestPath: String, in root: URL) -> (url: URL, type: String)? {
        var clean = requestPath
        while clean.hasPrefix("/") { clean.removeFirst() }
        if clean.contains("..") || clean.contains("\\") || clean.contains("\0") { return nil }
        let name = clean.split(separator: "/", omittingEmptySubsequences: false).last.map(String.init) ?? ""
        let dot = name.lastIndex(of: ".")
        if clean.isEmpty || dot == nil { clean = "index.html" }
        let fileName = clean.split(separator: "/").last.map(String.init) ?? clean
        let ext = fileName.split(separator: ".").last.map { $0.lowercased() } ?? ""
        let url = root.appendingPathComponent(clean).standardizedFileURL
        guard url.path.hasPrefix(root.path + "/") else { return nil }
        var directory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &directory), !directory.boolValue else { return nil }
        return (url, types[ext] ?? "application/octet-stream")
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        guard let requestURL = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        let root = self.root
        reader.async {
            let found = Self.file(for: requestURL.path, in: root)
            let data = found.flatMap { try? Data(contentsOf: $0.url, options: .alwaysMapped) }
            DispatchQueue.main.async {
                if self.stopped.remove(id) != nil { return }
                guard let found, let data else {
                    self.onMissing?(requestURL.absoluteString)
                    let response = HTTPURLResponse(url: requestURL, statusCode: 404, httpVersion: "HTTP/1.1",
                                                   headerFields: ["Content-Type": "text/plain; charset=utf-8", "Content-Length": "0"])!
                    task.didReceive(response)
                    task.didFinish()
                    return
                }
                let textual = found.type.hasPrefix("text/") || found.type.hasSuffix("json") || found.type.hasSuffix("+xml")
                let response = HTTPURLResponse(url: requestURL, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
                    "Content-Type": textual ? "\(found.type); charset=utf-8" : found.type,
                    "Content-Length": String(data.count),
                    // Scene files keep their names across releases: nothing may outlive the build that served it.
                    "Cache-Control": "no-cache",
                    "X-Content-Type-Options": "nosniff",
                ])!
                task.didReceive(response)
                task.didReceive(data)
                task.didFinish()
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(task))
    }
}
