import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/Users/isokaariqwe/.gemini/antigravity/brain/f0c91cce-d8b8-4a70-9eb2-801a198cc5ae';

async function testFullUserJourney() {
  console.log('=== TEST FULL USER JOURNEY ON PRODUCTION ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  // 1. Initial Fresh Load
  await page.goto('https://pelipaiva.pages.dev/?ts=' + Date.now(), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      if (d.name) indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Step 1 Screenshot: Onboarding Start
  const s1 = path.join(ARTIFACTS_DIR, '01_fresh_onboarding.png');
  await page.screenshot({ path: s1 });
  console.log('1. Captured Fresh Onboarding:', s1);

  // 2. Type child's name "Otso" and click Jatka
  const nameInput = page.getByPlaceholder(/esim. Otso/i);
  await nameInput.fill('Otso');
  await page.waitForTimeout(300);

  const jatkaBtn = page.getByRole('button', { name: /Jatka/i });
  await jatkaBtn.click();
  await page.waitForTimeout(600);

  // Step 2 Screenshot: Team Selector for Otso
  const s2 = path.join(ARTIFACTS_DIR, '02_team_preset_selector.png');
  await page.screenshot({ path: s2 });
  console.log('2. Captured Team Preset Selector:', s2);

  // 3. Open WhatsApp Import Modal
  const waBtn = page.locator('button').filter({ hasText: /WhatsApp-viesti/i }).first();
  if (await waBtn.isVisible()) {
    await waBtn.click();
    await page.waitForTimeout(800);
    const s3 = path.join(ARTIFACTS_DIR, '03_smart_import_modal.png');
    await page.screenshot({ path: s3 });
    console.log('3. Captured Smart Import Modal:', s3);

    // Test a11y escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 4. Open Family Code Join Modal
  const codeBtn = page.locator('button').filter({ hasText: /Perhe-koodi/i }).first();
  if (await codeBtn.isVisible()) {
    await codeBtn.click();
    await page.waitForTimeout(800);
    const s4 = path.join(ARTIFACTS_DIR, '04_family_code_modal.png');
    await page.screenshot({ path: s4 });
    console.log('4. Captured Family Code Modal:', s4);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 5. Desktop layout of onboarding wizard
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(600);
  const s5 = path.join(ARTIFACTS_DIR, '05_desktop_team_wizard.png');
  await page.screenshot({ path: s5 });
  console.log('5. Captured Desktop Wizard:', s5);

  await browser.close();
  console.log('=== ALL USER JOURNEY SCREENSHOTS SAVED ===');
}

testFullUserJourney().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
