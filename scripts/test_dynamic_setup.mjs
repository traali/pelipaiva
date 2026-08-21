import { chromium } from 'playwright';

(async () => {
  console.log('--- TESTING DYNAMIC PLAYER-BY-PLAYER SETUP ON LIVE PRODUCTION ---');
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

  // 1. Initial State: Clean input for Player 1
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_dynamic_step1_empty.png' });

  // 2. Type "Otso" and click Jatka
  await page.fill('input[placeholder*="Otso, Sofia"]', 'Otso');
  await page.click('button:has-text("Jatka")');
  await page.waitForTimeout(400);

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_dynamic_step2_otso_active.png' });

  // 3. Add PPJ Sininen & Salibandy for Otso
  const sininenBtn = page.getByRole('button', { name: /PPJ Laru Sininen/i }).first();
  if (await sininenBtn.isVisible()) {
    await sininenBtn.click();
    await page.waitForTimeout(600);
  }

  const salibandyBtn = page.getByRole('button', { name: /Salibandy/i }).first();
  if (await salibandyBtn.isVisible()) {
    await salibandyBtn.click();
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_dynamic_step3_otso_two_teams.png' });

  // 4. Click "+ Tallenna ja lisää seuraava pelaaja"
  const nextPlayerBtn = page.getByRole('button', { name: /Tallenna ja lisää seuraava pelaaja/i }).first();
  if (await nextPlayerBtn.isVisible()) {
    await nextPlayerBtn.click();
    await page.waitForTimeout(400);

    // 5. Add Sofia
    await page.fill('input[placeholder*="Otso, Sofia"]', 'Sofia');
    await page.click('button:has-text("Jatka")');
    await page.waitForTimeout(400);

    // 6. Add Basket.fi for Sofia
    const basketBtn = page.getByRole('button', { name: /Basket\.fi/i }).first();
    if (await basketBtn.isVisible()) {
      await basketBtn.click();
      await page.waitForTimeout(600);
    }
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_dynamic_step4_family_roster_complete.png' });

  // 7. Click Finish and enter the app!
  const finishBtn = page.getByRole('button', { name: /Valmis! Avaa Pelipäivä/i }).first();
  if (await finishBtn.isVisible()) {
    await finishBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_dynamic_step5_entered_hub.png' });
  }

  await browser.close();
  console.log('--- DYNAMIC SETUP TEST COMPLETE ---');
})();
