import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const screenshotsDir = path.resolve(process.cwd(), 'screenshots');

test.describe('📸 Visual Quality & Layout Audit Captures', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Capture Onboarding, Dashboard, Smart Import & Copilot Screens', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('Mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    // 1. Onboarding Screen
    await page.goto('/');
    await page.evaluate(async () => {
      localStorage.clear();
      const dbs = await window.indexedDB.databases();
      for (const d of dbs) {
        if (d.name) window.indexedDB.deleteDatabase(d.name);
      }
    });
    await page.reload();

    await expect(page.getByRole('heading', { name: /Perheen kalenteriasetus/i })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, `${prefix}-01-onboarding.png`), fullPage: true });

    // 2. Activate Demo & Capture Dashboard Cards
    const demoButton = page.getByRole('button', { name: /esimerkkidata/i }).first();
    await demoButton.click();
    await expect(page.getByRole('tab', { name: /Kaikki/i })).toBeVisible();
    await page.waitForTimeout(500); // Allow spring animations to settle
    await page.screenshot({ path: path.join(screenshotsDir, `${prefix}-02-dashboard-cards.png`), fullPage: true });

    // 3. Capture Timeline & Calendar Views
    const timelineButton = page.getByRole('tab', { name: /Tiivis/i });
    await timelineButton.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, `${prefix}-03-dashboard-timeline.png`), fullPage: true });

    const calendarButton = page.getByRole('tab', { name: /Kalenteri/i });
    await calendarButton.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, `${prefix}-04-dashboard-calendar.png`), fullPage: true });

    // Switch back to Cards
    await page.getByRole('tab', { name: /Kortit/i }).click();

    // 4. Capture Smart Import Modal (WhatsApp Tab)
    const addTeamButton = page.getByLabel('Lisää joukkue tai turnaus');
    await addTeamButton.click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    const whatsappTab = page.getByRole('tab', { name: /WhatsApp/i });
    await whatsappTab.click({ force: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, `${prefix}-05-smart-import-whatsapp.png`) });

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // 5. Capture Ask Copilot Modal
    const moreMenuButton = page.locator('header').getByRole('button', { name: 'Lisää', exact: true });
    await moreMenuButton.click();
    const askMenuItem = page.getByRole('button', { name: /Kysy aikataulusta/i });
    await askMenuItem.click();

    const copilotModal = page.locator('div[role="dialog"]');
    await expect(copilotModal).toBeVisible();
    await page.getByRole('button', { name: /kahviovuoroa/i }).click();
    await expect(page.getByText(/Pelipäivä Äly vastaa/i)).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, `${prefix}-06-ask-copilot.png`) });

    await page.keyboard.press('Escape');
    await expect(copilotModal).not.toBeVisible();
  });
});
