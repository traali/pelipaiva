# TRACE — REL

CI [ci.yml](../../../.github/workflows/ci.yml): npm ci, tsc app, vitest, build. **No eslint, no playwright, no worker tests.**

CD [cd.yml](../../../.github/workflows/cd.yml): build dist, pages-action project `pelipaiva`, wrangler deploy worker dir, wranglerVersion 4.124.0. Secrets CLOUDFLARE_*. FAMILY_CODES not in CD (dashboard secret).

Rollback: git revert + push. No staging project in repo.

Observability: `console.error('[PELIPAIVA:CRASH]')` ErrorBoundary; `console.warn` familyCloud. No Sentry, no CF log drains in repo.

Headers [public/_headers](../../../public/_headers): nosniff, DENY frame, referrer, Permissions-Policy camera/mic off, geo self.

vite port 3000 vs Worker CORS 5173 — local family sync broken unless origin added.
