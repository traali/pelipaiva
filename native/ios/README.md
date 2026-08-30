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

1. New iOS App target, iOS 26+, WKWebView full screen.
2. Add `FamdayAiBridge.swift` and inject `FamdayAiUserScript.js` at document start.
3. Register message handler `famdayAi`.
4. Load `https://pelipaiva.pages.dev`.
5. Mirror `localStorage.pelipaiva_ondevice_llm` into `UserDefaults` (the bridge fail-closes on `off`).
6. Optional: Background Asset for official Qwen3 0.6B `.aimodel` → `Application Support/FamdayAi/qwen3-0.6b`.

Until Qwen is packaged, Apple Intelligence (`LanguageModelSession`) is the
only neural engine. If Intelligence is unavailable, the PWA stays on
Aikataulujärki.

Do not enable Private Cloud Compute. Kids’ WhatsApp stays on-device.
