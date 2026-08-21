import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  console.log('Navigating to live production...');
  await page.goto('https://pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 1. Start Demo to load family timeline
  const demoBtn = page.getByRole('button', { name: /Kokeile esimerkkidatalla/i }).first();
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    await page.waitForTimeout(600);
  }

  // 2. Test Quick Drop-in Bar on main screen
  const dropInInput = page.locator('input[placeholder*="Liitä teksti"]').first();
  if (await dropInInput.isVisible()) {
    await dropInInput.click();
    await dropInInput.fill('Huomenna futispeli Väiskillä klo 17:00 (kokoontuminen 16.15). Sininen pelipaita.');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_quick_dropin_bar.png' });

    // Click Tallenna in the drop-in bar
    const saveBtn = page.getByRole('button', { name: /Tallenna/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_after_dropin_saved.png' });

  await browser.close();
  console.log('Quick drop-in verification complete!');
})();
