const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const artifactDir = path.resolve('C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4');
  const outDir = path.resolve('c:/dev2/pelipaiva/docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Launching browser in mobile emulation (iPhone 14 / 390x844)...');
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();

  console.log('Navigating to live production: https://pelipaiva.pages.dev ...');
  await page.goto('https://pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 1. Capture Onboarding Screen
  const screen1Path = path.join(outDir, 'mobile_prod_onboarding.png');
  const artifact1Path = path.join(artifactDir, 'mobile_prod_onboarding.png');
  await page.screenshot({ path: screen1Path, fullPage: false });
  fs.copyFileSync(screen1Path, artifact1Path);
  console.log(`Saved screenshot 1 to: ${screen1Path}`);

  // 2. Click "Kokeile esimerkkidatalla" to load matchday cards
  console.log('Clicking demo button...');
  const demoBtn = page.getByRole('button', { name: /Kokeile esimerkkidatalla/i });
  await demoBtn.waitFor({ state: 'visible', timeout: 5000 });
  await demoBtn.click();
  await page.waitForTimeout(1500);

  // 2. Capture Matchday Hub Mobile Viewport
  const screen2Path = path.join(outDir, 'mobile_prod_matchday_hub.png');
  const artifact2Path = path.join(artifactDir, 'mobile_prod_matchday_hub.png');
  await page.screenshot({ path: screen2Path, fullPage: false });
  fs.copyFileSync(screen2Path, artifact2Path);
  console.log(`Saved screenshot 2 to: ${screen2Path}`);

  // 3. Open Family Share Modal
  console.log('Opening Family Share modal...');
  const shareBtn = page.locator('button[title="Perhejako & Varmuuskopio"]').first();
  if (await shareBtn.count() > 0) {
    await shareBtn.click();
    await page.waitForTimeout(800);
    const screen3Path = path.join(outDir, 'mobile_prod_family_share.png');
    const artifact3Path = path.join(artifactDir, 'mobile_prod_family_share.png');
    await page.screenshot({ path: screen3Path, fullPage: false });
    fs.copyFileSync(screen3Path, artifact3Path);
    console.log(`Saved screenshot 3 to: ${screen3Path}`);

    // Close modal
    const closeBtn = page.locator('button:has-text("X"), button:has(svg.lucide-x)').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // 4. Open Match Stats Modal
  console.log('Opening Match Stats modal...');
  const statsBtn = page.locator('text=Avaa tilastot & kokoonpanot').first();
  if (await statsBtn.count() > 0) {
    await statsBtn.click();
    await page.waitForTimeout(800);
    const screen4Path = path.join(outDir, 'mobile_prod_stats_modal.png');
    const artifact4Path = path.join(artifactDir, 'mobile_prod_stats_modal.png');
    await page.screenshot({ path: screen4Path, fullPage: false });
    fs.copyFileSync(screen4Path, artifact4Path);
    console.log(`Saved screenshot 4 to: ${screen4Path}`);
  }

  await browser.close();
  console.log('All mobile screenshots captured successfully from production!');
}

capture().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
