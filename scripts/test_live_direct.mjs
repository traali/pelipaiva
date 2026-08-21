import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Create an isolated incognito context with service workers disabled
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  console.log('Navigating directly to deployment commit URL...');
  await page.goto('https://66632efe.pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 1. Screenshot Initial Empty State Step 1
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_direct_step1.png' });

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

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_direct_maija_two_sources.png' });

  // 4. Click + Lisää Eemil
  const eemilBtn = page.getByRole('button', { name: /\+ Lisää Eemil/i }).first();
  if (await eemilBtn.isVisible()) {
    await eemilBtn.click();
    await page.waitForTimeout(400);

    const valkoinenBtn = page.getByRole('button', { name: /PPJ Laru Valkoinen/i }).first();
    if (await valkoinenBtn.isVisible()) {
      await valkoinenBtn.click();
      await page.waitForTimeout(600);
    }
  }

  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_direct_family_summary.png' });

  await browser.close();
  console.log('Direct verification complete!');
})();
