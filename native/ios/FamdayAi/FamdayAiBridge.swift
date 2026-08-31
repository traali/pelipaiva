import Foundation
import WebKit

#if canImport(FoundationModels)
import FoundationModels
#endif
#if canImport(CoreAILanguageModels)
import CoreAILanguageModels
#endif

/// WKWebView bridge for Pelipäivä / FamDay.
/// Safari cannot see this. Only a native wrapper that loads the PWA
/// (or bundled dist) and injects `window.FamdayNativeAi`.
///
/// User opt-in is enforced in JS first. This bridge still refuses to
/// create a session unless `pelipaiva_ondevice_llm` in UserDefaults is
/// `apple` or `qwen06` (the PWA writes the same key via localStorage;
/// the wrapper should copy it across).
@MainActor
public final class FamdayAiBridge: NSObject, WKScriptMessageHandler {
    public static let messageHandlerName = "famdayAi"
    public static let userDefaultsChoiceKey = "pelipaiva_ondevice_llm"

    private weak var webView: WKWebView?
    private var qwenReady = false

    public init(webView: WKWebView) {
        self.webView = webView
        super.init()
    }

    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.messageHandlerName,
              let body = message.body as? [String: Any],
              let id = body["id"] as? String,
              let method = body["method"] as? String
        else { return }

        Task { @MainActor in
            do {
                let value = try await self.dispatch(method: method, body: body)
                self.reply(id: id, ok: true, value: value)
            } catch {
                self.reply(id: id, ok: false, value: error.localizedDescription)
            }
        }
    }

    private func dispatch(method: String, body: [String: Any]) async throws -> String {
        switch method {
        case "syncChoice":
            let choice = body["choice"] as? String ?? "off"
            UserDefaults.standard.set(choice, forKey: Self.userDefaultsChoiceKey)
            return "ok"
        case "availability":
            return await availability()
        case "engine":
            return currentEngine()
        case "prompt":
            let system = body["system"] as? String ?? ""
            let user = body["user"] as? String ?? ""
            return try await prompt(system: system, user: user)
        case "loadQwen":
            return try await loadQwen()
        case "unload":
            qwenReady = false
            return "ok"
        default:
            throw FamdayAiError.unsupported
        }
    }

    private func optedInChoice() -> String {
        UserDefaults.standard.string(forKey: Self.userDefaultsChoiceKey)
            ?? "off"
    }

    private func availability() async -> String {
        let choice = optedInChoice()
        if choice == "off" { return "unavailable" }

        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if choice == "apple" {
                return "readily"
            }
        }
        #endif

        #if canImport(CoreAILanguageModels)
        if choice == "qwen06" {
            return qwenReady ? "readily" : "downloadable"
        }
        #endif

        return "unavailable"
    }

    private func currentEngine() -> String {
        let choice = optedInChoice()
        if choice == "qwen06", qwenReady { return "apple_core_ai" }
        if choice == "apple" { return "apple_foundation" }
        return "none"
    }

    private func prompt(system: String, user: String) async throws -> String {
        let choice = optedInChoice()
        guard choice != "off" else { throw FamdayAiError.optedOut }

        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if choice == "qwen06" {
                #if canImport(CoreAILanguageModels)
                guard qwenReady else { throw FamdayAiError.notLoaded }
                let url = try qwenResourceURL()
                let model = try await CoreAILanguageModel(resourcesAt: url)
                let session = LanguageModelSession(model: model)
                let response = try await session.respond(to: "\(system)\n\n\(user)")
                return String(describing: response.content)
                #else
                throw FamdayAiError.unsupported
                #endif
            }

            let session = LanguageModelSession()
            let response = try await session.respond(to: "\(system)\n\n\(user)")
            return String(describing: response.content)
        }
        #endif
        throw FamdayAiError.unsupported
    }

    private func loadQwen() async throws -> String {
        #if canImport(CoreAILanguageModels)
        _ = try qwenResourceURL()
        qwenReady = true
        return "ok"
        #else
        throw FamdayAiError.notPackaged
        #endif
    }

    private func qwenResourceURL() throws -> URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        if let url = appSupport?.appendingPathComponent("FamdayAi/qwen3-0.6b", isDirectory: true),
           FileManager.default.fileExists(atPath: url.path) {
            return url
        }
        if let bundled = Bundle.main.url(forResource: "qwen3-0.6b", withExtension: nil) {
            return bundled
        }
        throw FamdayAiError.notPackaged
    }

    private func reply(id: String, ok: Bool, value: String) {
        let escaped = value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
        let js = "window.__famdayAiResolve && window.__famdayAiResolve('\(id)', \(ok), '\(escaped)')"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}

enum FamdayAiError: LocalizedError {
    case optedOut
    case notLoaded
    case notPackaged
    case unsupported

    var errorDescription: String? {
        switch self {
        case .optedOut: return "opted_out"
        case .notLoaded: return "qwen_not_loaded"
        case .notPackaged: return "Qwen 0.6B ei ole vielä paketoitu tähän sovellukseen. Käytä Apple Intelligencea tai Aikataulujärkeä."
        case .unsupported: return "unsupported"
        }
    }
}
