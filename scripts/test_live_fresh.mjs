import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  console.log('Navigating with fresh cache bust...');
  await page.goto('https://pelipaiva.pages.dev/?nocache=' + Date.now(), { waitUntil: 'networkidle' });

  // 0. Reset storage and service worker cache
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    const cacheKeys = await caches.keys();
    for (const k of cacheKeys) await caches.delete(k);
  });

  await page.goto('https://pelipaiva.pages.dev/?fresh=' + Date.now(), { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1. Screenshot Initial Empty State Step 1
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_fresh_wizard_step1.png' });

  // 2. Click PPJ Laru Sininen for Maija
  const sininenBtn = page.getByRole('button', { name: /PPJ Laru Sininen/i }).first();
  if (await sininenBtn.isVisible()) {
    await sininenBtn.click();
    await page.waitForTimeout(600);
  }

  // 3. Click Salibandy 25301 for Maija
  const salibandyBtn = page.getByRole('button', { name: /Salibandy/i }).first();
  if (await salibandyBtn.isVisible()) {
    await salibandyBtn.click();
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_fresh_wizard_maija_two_teams.png' });

  // 4. Click + Eemil to switch to next child
  const eemilBtn = page.getByRole('button', { name: /\+ Eemil/i }).first();
  if (await eemilBtn.isVisible()) {
    await eemilBtn.click();
    await page.waitForTimeout(400);

    const valkoinenBtn = page.getByRole('button', { name: /PPJ Laru Valkoinen/i }).first();
    if (await valkoinenBtn.isVisible()) {
      await valkoinenBtn.click();
      await page.waitForTimeout(600);
    }
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_fresh_wizard_family_roster.png' });

  await browser.close();
  console.log('Fresh verification complete!');
})();
