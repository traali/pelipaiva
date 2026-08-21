import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  console.log('Navigating to live production...');
  await page.goto('https://pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 1. Check Onboarding View
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_onboarding_smart.png' });

  // 2. Open Smart Import Modal
  const smartBtn = page.getByRole('button', { name: /Äly-tuonti/i }).first();
  if (await smartBtn.isVisible()) {
    await smartBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_smart_import_modal.png' });

    // Test WhatsApp parser in modal
    const textarea = page.locator('textarea').first();
    await textarea.fill('Moi vanhemmat! Lauantaina 24.8. pelataan harkkapeli Väiskillä klo 16:30 (kokoontuminen klo 15:45). Mustat pelipaidat päälle. Maijalla kahviovuoro klo 16-18.');
    await page.getByRole('button', { name: /Jäsennä ottelutiedot/i }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_parsed_whatsapp.png' });

    // Save event
    await page.getByRole('button', { name: /Tallenna/i }).click();
    await page.waitForTimeout(1800);
  }

  // 3. Check Matchday Card generated from WhatsApp
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_card_from_ai.png' });

  // 4. Open Kyytiapuri (Family Logistics)
  const carpoolBtn = page.getByRole('button', { name: /Kyytiapuri/i }).first();
  if (await carpoolBtn.isVisible()) {
    await carpoolBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_carpool_modal.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // 5. Open Kysy Älyltä (Ask Copilot)
  const askBtn = page.getByRole('button', { name: /Kysy/i }).first();
  if (await askBtn.isVisible()) {
    await askBtn.click();
    await page.waitForTimeout(600);
    // Click sample question
    const sampleChip = page.getByRole('button', { name: /kahviovuoro/i }).first();
    if (await sampleChip.isVisible()) {
      await sampleChip.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_ask_copilot.png' });
  }

  await browser.close();
  console.log('Smoke test and screenshots complete!');
})();
