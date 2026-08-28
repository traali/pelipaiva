import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/Users/isokaariqwe/.gemini/antigravity/brain/f0c91cce-d8b8-4a70-9eb2-801a198cc5ae';

async function runProductionVisualTest() {
  console.log('=== RUNNING COMPREHENSIVE PRODUCTION BROWSER TEST ===');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 / Mobile standard
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  // 1. Initial Load & Clear Data for clean onboarding
  console.log('1. Loading https://pelipaiva.pages.dev ...');
  await page.goto('https://pelipaiva.pages.dev/?ts=' + Date.now(), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Capture Onboarding Screen
  const screenshot1 = path.join(ARTIFACTS_DIR, 'prod_01_onboarding.png');
  await page.screenshot({ path: screenshot1, fullPage: false });
  console.log('Saved:', screenshot1);

  // 2. Click Demo Ingestion & wait for dashboard transition
  console.log('2. Triggering demo onboarding and waiting for ingestion...');
  const demoBtn = page.getByRole('button', { name: /Kokeile esimerkkidatalla/i }).first();
  await demoBtn.click();

  // Wait for Onboarding to disappear or Matchday Dashboard to appear
  await page.waitForFunction(() => {
    return !document.body.innerText.includes('Perheen kalenteriasetus');
  }, { timeout: 30000 }).catch(e => console.warn('Wait timed out, continuing:', e.message));

  await page.waitForTimeout(3000);

  // Capture Populated Dashboard Hero & Cards
  const screenshot2 = path.join(ARTIFACTS_DIR, 'prod_02_dashboard_cards.png');
  await page.screenshot({ path: screenshot2, fullPage: false });
  console.log('Saved:', screenshot2);

  // Scroll down to show match cards
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(800);
  const screenshot3 = path.join(ARTIFACTS_DIR, 'prod_03_match_cards_feed.png');
  await page.screenshot({ path: screenshot3, fullPage: false });
  console.log('Saved:', screenshot3);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // 3. Switch to Timeline View
  console.log('3. Switching to Timeline view...');
  const timelineBtn = page.locator('button').filter({ hasText: /tiivis/i }).first();
  if (await timelineBtn.isVisible()) {
    await timelineBtn.click();
    await page.waitForTimeout(1000);
    const screenshot4 = path.join(ARTIFACTS_DIR, 'prod_04_timeline_view.png');
    await page.screenshot({ path: screenshot4, fullPage: false });
    console.log('Saved:', screenshot4);
  }

  // 4. Switch to Calendar View
  console.log('4. Switching to Calendar view...');
  const calBtn = page.locator('button').filter({ hasText: /kalenteri/i }).first();
  if (await calBtn.isVisible()) {
    await calBtn.click();
    await page.waitForTimeout(1000);
    const screenshot5 = path.join(ARTIFACTS_DIR, 'prod_05_calendar_view.png');
    await page.screenshot({ path: screenshot5, fullPage: false });
    console.log('Saved:', screenshot5);
  }

  // 5. Desktop Viewport Test
  console.log('5. Testing Desktop Viewport (1280x800)...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1500);
  const screenshot6 = path.join(ARTIFACTS_DIR, 'prod_06_desktop_dashboard.png');
  await page.screenshot({ path: screenshot6, fullPage: false });
  console.log('Saved:', screenshot6);

  await browser.close();
  console.log('=== BROWSER TEST COMPLETE — ALL SCREENSHOTS SAVED ===');
}

runProductionVisualTest().catch(err => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
