import { chromium } from 'playwright';

(async () => {
  console.log('--- TESTING TOURNAMENT CUPS ONBOARDING ADDITION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  await page.goto('https://pelipaiva.pages.dev/?test=' + Date.now(), { waitUntil: 'networkidle' });

  // Clear storage
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1. Enter player name "s"
  await page.fill('input[placeholder*="Otso, Sofia"]', 's');
  await page.click('button:has-text("Jatka")');
  await page.waitForTimeout(500);

  // 2. Click "KW Memorial Cup 2026 · Indians"
  console.log('Clicking KW Memorial Cup button...');
  const kwBtn = page.getByRole('button', { name: /KW Memorial Cup/i }).first();
  if (await kwBtn.isVisible()) {
    await kwBtn.click();
    await page.waitForTimeout(1000);
  }

  // 3. Click "Espoo Liikkuu Tournament 2026 · TOPOLA"
  console.log('Clicking Espoo Liikkuu Tournament button...');
  const esliBtn = page.getByRole('button', { name: /Espoo Liikkuu/i }).first();
  if (await esliBtn.isVisible()) {
    await esliBtn.click();
    await page.waitForTimeout(1000);
  }

  // 4. Click "Helsinki Cup 2026 · PPJ/Laru sin"
  console.log('Clicking Helsinki Cup button...');
  const hcBtn = page.getByRole('button', { name: /Helsinki Cup/i }).first();
  if (await hcBtn.isVisible()) {
    await hcBtn.click();
    await page.waitForTimeout(1000);
  }

  // Screenshot wizard state with the 3 cups added
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_tournaments_onboarding_fixed.png' });

  // 5. Open Pelipäivä
  const openBtn = page.getByRole('button', { name: /Avaa Pelipäivä/i }).first();
  if (await openBtn.isVisible()) {
    await openBtn.click();
    await page.waitForTimeout(1200);
  }

  // Screenshot matchday view
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_tournaments_timeline_fixed.png' });

  await browser.close();
  console.log('--- TOURNAMENT TESTS COMPLETE ---');
})();
