import { chromium } from 'playwright';

(async () => {
  console.log('--- TESTING ACCURATE TEAM DATA ON LIVE PROD ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  await page.goto('https://pelipaiva.pages.dev/?v=' + Date.now(), { waitUntil: 'networkidle' });

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

  // 1. Add player "simo"
  await page.fill('input[placeholder*="Otso, Sofia"]', 'simo');
  await page.click('button:has-text("Jatka")');
  await page.waitForTimeout(400);

  // 2. Select PPJ Laru Sininen (185085) for simo
  const sininenBtn = page.getByRole('button', { name: /PPJ Laru Sininen/i }).first();
  if (await sininenBtn.isVisible()) {
    await sininenBtn.click();
    await page.waitForTimeout(800);
  }

  // 3. Click "Valmis! Avaa Pelipäivä"
  const finishBtn = page.getByRole('button', { name: /Valmis! Avaa Pelipäivä/i }).first();
  if (await finishBtn.isVisible()) {
    await finishBtn.click();
    await page.waitForTimeout(800);
  }

  // 4. Take screenshot of the timeline with simo's real team data
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_simo_ppj_sininen_timeline.png' });

  const cardTitle = await page.textContent('h3, .text-xl, .font-black');
  console.log('Live card text:', cardTitle);

  await browser.close();
  console.log('--- TEST FINISHED ---');
})();
