import { chromium } from 'playwright';

(async () => {
  console.log('--- EXHAUSTIVE LIVE PRODUCTION AUDIT ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  // 1. Check HTTP response on live apex domain
  const res = await fetch('https://pelipaiva.pages.dev/?audit=' + Date.now());
  console.log('Production Apex HTTP Status:', res.status, res.statusText);

  // 2. Open page in browser
  await page.goto('https://pelipaiva.pages.dev/?audit=' + Date.now(), { waitUntil: 'networkidle' });

  // 3. Clear storage for initial clean onboarding audit
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Take screenshot of empty onboarding
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/audit_01_onboarding.png' });

  // 4. Load full demo suite (5 teams across sports & tournament weekend)
  const demoBtn = page.getByRole('button', { name: /esimerkkidatalla/i }).first();
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    // Wait for the loader to vanish
    await page.waitForSelector('text=Haetaan otteluita tulospalvelusta', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Take screenshot of populated matchday timeline & Mission Control HUD
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/audit_02_timeline_hud.png' });

  // 5. Scroll down to inspect match cards, weather, footwear advice
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/audit_03_match_card_details.png' });

  await browser.close();
  console.log('--- AUDIT SCREENSHOTS READY ---');
})();
