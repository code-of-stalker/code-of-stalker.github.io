import UIKit
import UniformTypeIdentifiers
import WebKit

/// The whole app: one web view showing the web export from the app bundle.
///
/// The origin `codeofstalker://localhost` is permanent. The diary (IndexedDB) and its
/// encryption key belong to this app and this origin, so the scheme and host never change.
/// WebKit counts a page from a scheme served by a WKURLSchemeHandler as a secure context,
/// which the diary's WebCrypto needs.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, ShellHost,
    UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    static let scheme = "codeofstalker"
    static let host = "localhost"
    static let start = URL(string: "\(scheme)://\(host)/")!

    private(set) var webView: WKWebView!
    private let bridge = ShellBridge()
    private var pageBackground = UIColor.black
    private var lightPage = false
    private var exportDone: ((Bool) -> Void)?
    #if HARNESS
    private var harness: Harness?
    #endif

    override var preferredStatusBarStyle: UIStatusBarStyle { lightPage ? .darkContent : .lightContent }

    override func loadView() {
        let root = UIView()
        root.backgroundColor = pageBackground
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let web = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
        let files = AppSchemeHandler(root: web)
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(files, forURLScheme: Self.scheme)
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        // Answers and voice notes play from the page's own controls.
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.dataDetectorTypes = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let content = configuration.userContentController
        content.addUserScript(WKUserScript(source: ShellBridge.pageScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addScriptMessageHandler(bridge, contentWorld: .page, name: ShellBridge.name)
        bridge.host = self

        let webView = WKWebView(frame: .zero, configuration: configuration)
        self.webView = webView
        webView.navigationDelegate = self
        webView.uiDelegate = self
        // One back only: the page's own edge swipe, as on the iPhone site.
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = pageBackground
        webView.underPageBackgroundColor = pageBackground
        webView.scrollView.backgroundColor = pageBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        // The page never runs under the status bar or the home indicator; those areas
        // show the page color (applyTheme), as the Android app does.
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: guide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: guide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: guide.trailingAnchor),
        ])

        #if HARNESS
        if Harness.enabled {
            let harness = Harness(controller: self)
            self.harness = harness
            files.onMissing = { harness.event("missing", $0) }
            bridge.onSaved = { harness.keepSaved($0) }
            harness.prepare { [weak self] in self?.webView.load(URLRequest(url: Self.start)) }
            return
        }
        #endif
        webView.load(URLRequest(url: Self.start))
    }

    // MARK: ShellHost

    func applyTheme(background: UIColor, light: Bool) {
        pageBackground = background
        lightPage = light
        view.backgroundColor = background
        view.window?.backgroundColor = background
        webView.backgroundColor = background
        webView.underPageBackgroundColor = background
        webView.scrollView.backgroundColor = background
        setNeedsStatusBarAppearanceUpdate()
    }

    func exportFile(_ url: URL, done: @escaping (Bool) -> Void) {
        guard exportDone == nil, presentedViewController == nil else { done(false); return }
        let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
        picker.delegate = self
        picker.shouldShowFileExtensions = true
        exportDone = done
        present(picker, animated: true)
        picker.presentationController?.delegate = self
    }

    /// Ends the pending export exactly once.
    func finishExport(_ stored: Bool) {
        let done = exportDone
        exportDone = nil
        done?(stored)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        finishExport(!urls.isEmpty)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finishExport(false)
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        finishExport(false)
    }

    // MARK: Navigation

    private func isOurs(_ url: URL) -> Bool {
        url.scheme?.lowercased() == Self.scheme && url.host?.lowercased() == Self.host
    }

    private func openOutside(_ url: URL) {
        guard let scheme = url.scheme?.lowercased(), ["http", "https", "mailto", "tel"].contains(scheme) else { return }
        UIApplication.shared.open(url)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if isOurs(url) { decisionHandler(.allow); return }
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if !mainFrame, let scheme = url.scheme?.lowercased(), ["about", "blob", "data"].contains(scheme) {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        // Anything else leaves the app: the system opens it (Safari, Mail, Phone).
        if mainFrame { openOutside(url) }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, !isOurs(url) { openOutside(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // An app page, not a document: no pinch zoom.
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The page process was killed (memory pressure): start the page again, as Android does.
        if webView.url == nil { webView.load(URLRequest(url: Self.start)) } else { webView.reload() }
    }

    // MARK: Permissions and dialogs

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        // Our own page may record voice; iOS then asks once with NSMicrophoneUsageDescription.
        let ours = frame.isMainFrame && origin.protocol == Self.scheme && origin.host == Self.host
        decisionHandler(ours && type == .microphone ? .grant : .deny)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        guard presentedViewController == nil else { completionHandler(); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "ОК", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        guard presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Отмена", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "ОК", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    // MARK: Test builds

    #if HARNESS
    var statusBarIsLight: Bool { !lightPage }
    var pageBackgroundColor: UIColor { pageBackground }
    #endif
}
