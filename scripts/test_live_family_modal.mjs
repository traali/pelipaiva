import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  console.log('Navigating to live production...');
  await page.goto('https://pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 1. Click demo button if on onboarding
  const demoBtn = page.getByRole('button', { name: /esimerkkidatalla/i }).first();
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    await page.waitForTimeout(800);
  }

  // 2. Click the "Perhe" button in MultiProfileHeader
  const familyBtn = page.locator('button:has-text("Perhe")').first();
  if (await familyBtn.isVisible()) {
    await familyBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_family_manage_modal.png' });
  }

  await browser.close();
  console.log('Family modal captured!');
})();
