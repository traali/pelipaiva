# 06 — UI / UX

## What we know

Single SPA shell (`App.tsx`). No React Router. Surfaces: Onboarding (local / create / join), HUD, profile tabs, cards/timeline/calendar, Perhe, SmartImport, Copilot, HomeLocation (walk/bike/car/bussi/auto), Ambient, drop-in, merge, stats, parking.

**Observed (Playwright Chromium Pixel 7 + desktop, this week):** local onboarding → HUD → Perhe tekoäly → Copilot Aikataulujärki → import tabs. **Inferred (not iOS Safari WebKit):** Apple/Qwen radios listed disabled.

Tokens: `src/styles/tokens.css`, OLED/Floodlight. ErrorBoundary is inline CSS, not tokens.

Risks: PERHE-2 copy 403; Safari radios look “broken”; HUD line grows with transit label; DemoBanner still compiled for old demo ids.

Instrument: Playwright observed Chromium. iOS claims inferred from UA unit tests.

## Infer
Finnish parent tone is consistent. Empty local finish is now a real path.

## Do not know
VoiceOver on iPhone; reduced-motion; contrast in Floodlight mode.
