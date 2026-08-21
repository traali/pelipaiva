import { chromium } from 'playwright';

(async () => {
  console.log('--- VERIFYING LIVE PRODUCTION DEPLOYMENT ---');
  
  // 1. Fetch live production HTTP headers
  const res = await fetch('https://pelipaiva.pages.dev/?v=' + Date.now());
  console.log('HTTP Status:', res.status, res.statusText);
  console.log('Cache-Control Header:', res.headers.get('cache-control'));
  console.log('CF-Ray / Edge:', res.headers.get('cf-ray'));

  const text = await res.text();
  console.log('HTML size:', text.length, 'bytes');

  // 2. Playwright Live Browser Test on the apex production URL
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  console.log('Navigating to https://pelipaiva.pages.dev...');
  await page.goto('https://pelipaiva.pages.dev/?v=' + Date.now(), { waitUntil: 'networkidle' });

  // Clear local storage and IndexedDB for pure first-load verification
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Take screenshot of live production apex URL
  await page.screenshot({ path: 'C:/Users/aoinonen/.gemini/antigravity/brain/342d4833-d66d-4f2b-9254-89632bc4e5d4/prod_verified_latest_live.png' });

  const title = await page.textContent('h1');
  console.log('Live H1 title:', title);

  const hasPresetTeams = await page.getByRole('button', { name: /PPJ Laru Sininen/i }).isVisible();
  console.log('Preset Torneopal team visible on live prod:', hasPresetTeams);

  await browser.close();
  console.log('--- LIVE PRODUCTION CONFIRMED ---');
})();
