import { chromium } from 'playwright';

(async () => {
  console.log('--- TESTING FULL WEEK SCHEDULE & UPCOMING TOURNAMENTS ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  await page.goto('https://pelipaiva.pages.dev/?v=' + Date.now(), { waitUntil: 'networkidle' });

  // Clear storage and reload demo
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const demoBtn = page.getByRole('button', { name: /esimerkkidatalla/i }).first();
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    await page.waitForSelector('text=Haetaan otteluita tulospalvelusta', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Screenshot top view with full week schedule
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_week_schedule_live.png' });

  // Scroll down to tournament panel and screenshot
  await page.evaluate(() => window.scrollBy(0, 450));
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_tournament_panel_live.png' });

  await browser.close();
  console.log('--- TEST FINISHED ---');
})();
