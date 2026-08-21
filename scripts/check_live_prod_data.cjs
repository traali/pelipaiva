const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function checkProdData() {
  const artifactDir = path.resolve('C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4');
  const outDir = path.resolve('c:/dev2/pelipaiva/docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Connecting to live production: https://pelipaiva.pages.dev ...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  // Listen to console logs and network requests
  page.on('console', msg => console.log(`[BROWSER LOG] ${msg.text()}`));

  await page.goto('https://pelipaiva.pages.dev', { waitUntil: 'networkidle' });

  // 1. Check Onboarding View
  console.log('1. Onboarding Page Loaded.');

  // 2. Open Calendar Import Modal
  const importBtn = page.getByRole('button', { name: /Syötä oma kalenteri/i });
  if (await importBtn.count() > 0) {
    await importBtn.click();
    await page.waitForTimeout(600);

    // Capture Import Modal showing popular presets
    const importModalPath = path.join(outDir, 'prod_check_import_modal.png');
    await page.screenshot({ path: importModalPath });
    fs.copyFileSync(importModalPath, path.join(artifactDir, 'prod_check_import_modal.png'));
    console.log('Saved import modal screenshot.');

    // Close import modal
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 3. Click Demo Data to Inspect Live Matchday View
  const demoBtn = page.getByRole('button', { name: /Kokeile esimerkkidatalla/i });
  if (await demoBtn.count() > 0) {
    await demoBtn.click();
    await page.waitForTimeout(1500);
    console.log('Demo mode loaded.');
  }

  // 4. Capture Main Matchday Hub with cards
  const hubPath = path.join(outDir, 'prod_check_matchday_cards.png');
  await page.screenshot({ path: hubPath, fullPage: true });
  fs.copyFileSync(hubPath, path.join(artifactDir, 'prod_check_matchday_cards.png'));
  console.log('Saved matchday cards fullpage screenshot.');

  // 5. Open First Match Stats Modal
  const statsBtn = page.locator('text=Avaa tilastot & kokoonpanot').first();
  if (await statsBtn.count() > 0) {
    await statsBtn.click();
    await page.waitForTimeout(800);

    const statsPath = path.join(outDir, 'prod_check_match_stats.png');
    await page.screenshot({ path: statsPath });
    fs.copyFileSync(statsPath, path.join(artifactDir, 'prod_check_match_stats.png'));
    console.log('Saved match stats modal screenshot.');

    // Switch to Standings tab
    const standingsTab = page.locator('button:has-text("Sarjataulukko")').first();
    if (await standingsTab.count() > 0) {
      await standingsTab.click();
      await page.waitForTimeout(500);

      const standingsPath = path.join(outDir, 'prod_check_standings_tab.png');
      await page.screenshot({ path: standingsPath });
      fs.copyFileSync(standingsPath, path.join(artifactDir, 'prod_check_standings_tab.png'));
      console.log('Saved standings tab screenshot.');
    }
  }

  await browser.close();
  console.log('Live production check completed successfully!');
}

checkProdData().catch(err => {
  console.error('Error during prod data check:', err);
  process.exit(1);
});
