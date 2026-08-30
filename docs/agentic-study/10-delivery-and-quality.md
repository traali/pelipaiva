# 10 — Delivery and quality

## What we know

| Gate | What | Prod merge? |
|---|---|---|
| CI tsc app | yes | yes |
| CI vitest | yes (~462) | yes |
| CI build PWA | yes | yes |
| eslint | script exists | **no** |
| Playwright | script exists | **no** |
| Worker tests | familyCloud.test reads worker source | indirect |
| Coverage | npm script | **no** |

CD: Pages `dist` + wrangler worker. Rollback = git revert.

Observability: console only. No SLO.

Test truthfulness: strong parsers/federation fixtures. Folder `tests/e2e/tier*` is unit. Playwright Chromium observed locally; not CI. iOS Safari absent.

## Infer
CI can be trusted for **domain logic + typecheck + bundle**. Not for mobile Safari or family CORS on Vite.

## Do not know
Flake rate of Playwright on GHA ubuntu (never run there).
