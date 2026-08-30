# TRACE — SEC

Threat model: unauthenticated PWA; family bus is the only shared store; proxy is SSRF surface.

PASS: fail-closed FAMILY_CODES; CORS origin allowlist on Worker; If-Match; rate limit; proxy https+allowlist; no cloud LLM; neural flag not in KV; geolocation Permissions-Policy self.

RISK:
- `xlsx@0.18.5` [package.json](../../../package.json) L34; cap 2MB [tableAndExcelParser.ts](../../../src/lib/ai/tableAndExcelParser.ts) L182–191.
- OCR fallback to default tesseract CDN [ocrImageParser.ts](../../../src/lib/ai/ocrImageParser.ts) L37–40 if self-host fails.
- Actions `actions/checkout@v4` floating tag [ci.yml](../../../.github/workflows/ci.yml) L19; `cloudflare/pages-action@v1`.
- Pages HTML probe showed `access-control-allow-origin: *` (not in public/_headers) — static assets public anyway.
- First names + calendar URLs in KV (GDPR household; constitution last-names only).
- `generateFamilyCode` still in tree (uncalled).
- Nominatim from browser with User-Agent Pelipaiva — ToS; no key.

Q-001: KV namespace **id** in wrangler.jsonc is a Cloudflare binding identifier, not a credential. Expected public. Access still needs account token.
