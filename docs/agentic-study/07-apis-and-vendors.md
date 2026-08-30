# 07 — APIs and vendors

## What we know

| Vendor | Direction | Auth | Timeout | Fallback | Owner |
|---|---|---|---|---|---|
| Worker family | PWA ↔ Worker | issued code + CORS | 10s | 403/409 | familyCloud.ts, worker.ts |
| Worker proxy | PWA → Worker → vendor | none; allowlist | ingest 10s; ICS collect 8s | empty / catch null | proxyUrl.ts, worker.ts |
| Palloliitto HTML | GET via proxy | none | 10s | null official | statsEngine / ingestOfficial |
| Salibandy HTML | GET | none | 10s | null | same |
| koripallo-api.torneopal.net | GET JSON | none | client | skip HTML | torneopalClient.ts |
| Torneopal taso HTML | GET | none | | cup catalog | ingestOfficial |
| Nimenhuuto/MyClub/Jopox ICS | GET | secret in URL (treat as secret) | 8s | skip feed | worker collectRosterIcs |
| FMI | GET | none | geocode 5s / weather | null weather | fmiWeatherEngine.ts |
| LIPAS / api.hel.fi | GET | none | 5s / 4s | approximate Töölö flag | sportsGeocoder.ts |
| Nominatim | GET browser | UA string | 4s | null | homeLocation.ts |
| Chrome LanguageModel | in-page | user gesture | session | NLP | onDeviceLlm.ts |
| Pages /api/calendar | GET → Worker | family query | | 403 JSON | functions/api/calendar.js |

Proxy control: https, no IP, no userinfo, `hostnameAllowed`. Residual: `*.torneopal.com`.

Probes: pages 200; calendar unknown_family 403 JSON (not SPA HTML).

## Infer
ICS club URLs in KV are capability URLs (anyone with family code can have Worker fetch them).

## Do not know
Vendor rate limits / ToS for Nominatim from many parents.
