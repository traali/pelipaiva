# 09 — Security

## What we know

**Authn:** none. **Authz:** knowledge of an issued Crockford code + Worker secret allowlist. Empty secret → 403.

**SSRF:** proxy gated by allowlist. Wildcard `*.torneopal.*` is the remaining hole (HTTPS only).

**CORS:** Worker first-party origins. **Gap:** Vite `localhost:3000` not listed (5173 is). Pages HTML GET showed ACAO `*` (static).

**Concurrency:** If-Match 409; leftover `X-Pelipaiva-Rev`. Rate limits per IP.

**Supply chain:** `xlsx@0.18.5` + 2MB cap; Tesseract CDN fallback; GHA `checkout@v4` / `pages-action@v1` moving tags.

**PII:** first names + team URLs in KV; ICS SUMMARY prefixed with playerName (worker.ts prefixVeventSummary). Last names not in schema. Neural prompts stay on device if used.

**Uploads:** xlsx/OCR local parse. Camera permission denied by headers; file picker still works.

## Infer
Threat is less “account takeover” than “code leak + ICS secret URL in KV”.

## Do not know
Secret scanning of git history; whether any FAMILY_CODES ever landed in git (must not print if found — treat as UNKNOWN unless tools prove).
