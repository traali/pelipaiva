import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  console.log('Navigating to live production...');
  await page.goto('https://pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 0. Reset storage so we are in clean Empty State
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. Screenshot Initial Empty State Step 1
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_step1_empty_state.png' });

  // 2. Add PPJ Laru Sininen for Maija
  const ppjSinBtn = page.getByRole('button', { name: /PPJ Laru Sininen/i }).first();
  if (await ppjSinBtn.isVisible()) {
    await ppjSinBtn.click();
    await page.waitForTimeout(600);
  }

  // 3. Add Salibandy 25301 for Maija (2nd team for same player)
  const salibandyBtn = page.getByRole('button', { name: /Salibandy \(25301\)/i }).first();
  if (await salibandyBtn.isVisible()) {
    await salibandyBtn.click();
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_step2_maija_two_teams.png' });

  // 4. Click + Eemil to add next player
  const eemilBtn = page.getByRole('button', { name: /\+ Eemil/i }).first();
  if (await eemilBtn.isVisible()) {
    await eemilBtn.click();
    await page.waitForTimeout(400);

    // Add PPJ Valkoinen for Eemil
    const ppjValkBtn = page.getByRole('button', { name: /PPJ Laru Valkoinen/i }).first();
    if (await ppjValkBtn.isVisible()) {
      await ppjValkBtn.click();
      await page.waitForTimeout(600);
    }
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_step3_family_summary.png' });

  // 5. Click Valmis! Siirry Pelipäivään to enter hub
  const finishBtn = page.getByRole('button', { name: /Valmis! Siirry Pelipäivään/i }).first();
  if (await finishBtn.isVisible()) {
    await finishBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_step4_entered_hub.png' });
  }

  await browser.close();
  console.log('Multi-player guided onboarding test complete!');
})();
