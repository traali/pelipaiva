# TRACE — UIX

Surfaces: OnboardingWizard (choice / local / family_create / family_join), HUD, profile tabs, cards/timeline/calendar, Perhe (home + tekoäly), SmartImport, Copilot, HomeLocation (walk/bike/car), Ambient, drop-in.

Journeys:
- Local finish without team now reaches HUD (`App.tsx` isOnboardingActive only).
- Perhe → Kotiosoite Muokkaa; HUD Lisää → Kotiosoite.
- Tekoäly default off; Safari Apple/Qwen disabled radios still listed (onDeviceLlm options).
- Copilot label Aikataulujärki.

a11y: many aria-labels (Perhe, + Joukkue). ErrorBoundary uses inline styles, not tokens. Playwright Pixel 7 16/16 on local path (this week). iOS Safari not WebKit-tested.

Copy: onboarding family_join example “PERHE-2” will 403 unless issued.
