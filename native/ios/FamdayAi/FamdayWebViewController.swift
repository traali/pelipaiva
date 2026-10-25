import UIKit
import WebKit

public class FamdayWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var aiBridge: FamdayAiBridge!

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let config = WKWebViewConfiguration()
        let userContentController = WKUserContentController()

        // Inject FamdayAiUserScript.js at document start
        if let scriptPath = Bundle.main.path(forResource: "FamdayAiUserScript", ofType: "js"),
           let scriptSource = try? String(contentsOfFile: scriptPath) {
            let userScript = WKUserScript(
                source: scriptSource,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
            userContentController.addUserScript(userScript)
        }

        config.userContentController = userContentController
        config.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        view.addSubview(webView)

        // Initialize and register AI Bridge
        aiBridge = FamdayAiBridge(webView: webView)
        userContentController.add(aiBridge, name: FamdayAiBridge.messageHandlerName)

        // Load production PWA
        if let url = URL(string: "https://pelipaiva.pages.dev") {
            webView.load(URLRequest(url: url))
        }
    }

    // Mirror localStorage preference into UserDefaults on navigation commit
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("localStorage.getItem('pelipaiva_ondevice_llm')") { (result, _) in
            if let choice = result as? String {
                UserDefaults.standard.set(choice, forKey: FamdayAiBridge.userDefaultsChoiceKey)
            }
        }
    }
}
