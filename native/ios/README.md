# FamDay iOS wrapper (Core AI / Apple Intelligence)

Safari **cannot** call Apple Intelligence or Core AI. This folder is the
native WKWebView shell that loads `https://pelipaiva.pages.dev` and
injects `window.FamdayNativeAi`.

The PWA stays the product. This wrapper only adds the neural bus.

## What the user sees

| Surface | Neural net |
|---|---|
| iPhone Safari / Home Screen PWA | No. Aikataulujärki only. Toggle explains this. |
| This WKWebView app (TestFlight) | Yes, **after** Perhe → Laitteen tekoäly → Apple or Lataa Qwen |
| Chrome laptop | Gemini Nano via Prompt API, same toggle, no native code |

Default is **off**. Nothing downloads until the user taps **Lataa**.

## Wire-up (Xcode, on a Mac)

1. Create a new iOS App project in Xcode (iOS 26+ target).
2. Add the Swift and JS files from this directory to your Xcode target:
   - `FamdayAi/FamdayAiBridge.swift`
   - `FamdayAi/FamdayAiUserScript.js` (add as a bundle resource)
   - `FamdayAi/FamdayWebViewController.swift` (set as the root view controller in SceneDelegate or SwiftUI `UIViewControllerRepresentable`)
3. `FamdayWebViewController` automatically:
   - Injects `FamdayAiUserScript.js` at document start.
   - Registers the `famdayAi` message handler (`FamdayAiBridge`).
   - Mirrors `localStorage.pelipaiva_ondevice_llm` into `UserDefaults` on every navigation and storage change event.
   - Loads `https://pelipaiva.pages.dev`.
4. Optional fallback: Download official Qwen3 0.6B `.aimodel` via Apple Background Assets to `Application Support/FamdayAi/qwen3-0.6b` (Wi-Fi only, never embedded in IPA).

Until Qwen is packaged, Apple Intelligence (`LanguageModelSession`) is the
primary neural engine. If Intelligence is unavailable or off, the PWA remains on
Aikataulujärki.

Do not enable Private Cloud Compute. Kids’ WhatsApp stays on-device.
