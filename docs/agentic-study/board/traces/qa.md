# TRACE — QA

Vitest include `src/**/*.test.ts` + `tests/**/*.test.ts` node env + fake-indexeddb. ~462 tests at last local run (this conversation). CI runs vitest.

`tests/e2e/tier1_*` are **not browser e2e** — node tests with fixtures.

Playwright `tests/e2e/playwright/`: Android Pixel 7 + Desktop Chrome; `npm run test:e2e` **not in CI**. visual_audit uses `waitForTimeout` (flake).

Hunters: statsEngine.test.ts still calls generateOrResolveMatchStats — keeps factory “tested” not deleted.

No Worker unit test file under cloudflare-worker/ besides client familyCloud.test.ts reading worker source string for FAMILY_CODES.

iOS Safari: unit UA mocks only.
