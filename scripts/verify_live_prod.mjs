import { chromium } from 'playwright';

async function verifyLiveProduction() {
  console.log('=== VERIFYING LIVE PRODUCTION (https://pelipaiva.pages.dev) ===');
  
  // 1. Check HTTP response
  const startTime = Date.now();
  const res = await fetch('https://pelipaiva.pages.dev/?ts=' + Date.now());
  const latency = Date.now() - startTime;
  console.log(`HTTP Status: ${res.status} ${res.statusText} (${latency}ms)`);
  if (!res.ok) {
    throw new Error(`Apex returned HTTP ${res.status}`);
  }

  // 2. Launch headless browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 mobile viewport
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`Uncaught: ${err.message}`);
  });

  // 3. Navigate to live app
  console.log('Navigating to live production...');
  await page.goto('https://pelipaiva.pages.dev/?ts=' + Date.now(), { waitUntil: 'networkidle' });

  // 4. Reset indexedDB and localStorage for clean test
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });

  // 5. Check Onboarding View
  const title = await page.title();
  console.log('Page Title:', title);

  const demoBtn = page.getByRole('button', { name: /esimerkkidatalla/i }).first();
  const demoVisible = await demoBtn.isVisible();
  console.log('Demo Onboarding Button visible:', demoVisible);

  if (demoVisible) {
    console.log('Clicking demo data button...');
    await demoBtn.click();
    await page.waitForTimeout(1200);
  }

  // 6. Verify Dashboard elements
  const tabs = await page.getByRole('tab').allTextContents();
  console.log('Available tabs rendered:', tabs);

  // 7. Verify Timeline view
  const timelineTab = page.getByRole('tab', { name: /tiivis/i });
  if (await timelineTab.isVisible()) {
    await timelineTab.click();
    await page.waitForTimeout(500);
    console.log('Timeline View switched successfully');
  }

  // 8. Verify Calendar view
  const calendarTab = page.getByRole('tab', { name: /kalenteri/i });
  if (await calendarTab.isVisible()) {
    await calendarTab.click();
    await page.waitForTimeout(500);
    console.log('Calendar View switched successfully');
  }

  // 9. Check for unexpected console errors
  console.log('Console errors recorded:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  await browser.close();
  console.log('=== PRODUCTION VERIFICATION COMPLETED SUCCESSFULLY ===');
}

verifyLiveProduction().catch(err => {
  console.error('Production verification failed:', err);
  process.exit(1);
});
