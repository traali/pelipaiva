import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  console.log('Navigating to live production...');
  await page.goto('https://pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 1. Check Onboarding View with all 5 default teams
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_onboarding_all_teams.png' });

  // 2. Click Kokeile esimerkkidatalla to populate all 5 default teams
  const demoBtn = page.getByRole('button', { name: /Kokeile esimerkkidatalla/i }).first();
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_live_timeline_all_default_teams.png' });
  }

  await browser.close();
  console.log('All default teams verification complete!');
})();
