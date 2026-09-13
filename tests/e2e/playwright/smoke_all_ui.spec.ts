import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installFederationMocks } from './helpers/federationMocks';

const SHOT_DIR = path.resolve(process.cwd(), 'screenshots/smoke-all');

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

async function resetClient(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await window.indexedDB.databases();
    for (const d of dbs) {
      if (d.name) window.indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload();
}

async function enterLocalHud(page: Page) {
  await expect(page.getByRole('heading', { name: /Miten haluat käyttää FamDayta/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Vain tämä laite/i }).click();
  await page.getByRole('button', { name: /Siirry FamDay-ottelukeskukseen/i }).click();
  await expect(page.getByRole('tab', { name: /Kaikki/i }).first()).toBeVisible({ timeout: 20_000 });
}

async function openHudMenu(page: Page) {
  const backdrop = page.locator('div.fixed.inset-0.z-40');
  if (await backdrop.count()) {
    await backdrop.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.locator('header').getByRole('button', { name: 'Lisää', exact: true }).click({ force: true });
}

async function closeDialog(page: Page) {
  await page.keyboard.press('Escape');
  const backdrop = page.locator('div.fixed.inset-0.z-40');
  if (await backdrop.count()) {
    await backdrop.first().click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(200);
}

test.describe('Smoke all UI + mocked MyClub / Nimenhuuto / Torneopal', () => {
  test.describe.configure({ mode: 'serial' });

  test('walk every reachable surface with federation mocks', async ({ page }) => {
    test.setTimeout(120_000);
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await installFederationMocks(page);
    await resetClient(page);
    await shot(page, '01-onboarding');
    await enterLocalHud(page);
    await shot(page, '02-empty-hud');

    await page.getByLabel('Lisää joukkue tai turnaus').click();
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    await shot(page, '03-import-classic');
    const playerInput = dialog.getByPlaceholder('+ Uusi nimi');
    if (await playerInput.isVisible()) await playerInput.fill('Simo');
    await dialog.getByPlaceholder(/tulospalvelu.palloliitto|.ics-linkki/i).fill('https://www.nimenhuuto.com/events/ical/hjk-t13');
    await dialog.getByPlaceholder(/HJK Sininen/i).fill('HJK T13 Sininen');
    await shot(page, '04-import-nimenhuuto-filled');
    await dialog.getByRole('button', { name: /Tuo joukkue/i }).click();
    await page.waitForTimeout(1200);
    await shot(page, '05-after-nimenhuuto-import');
    if (await dialog.isVisible()) await closeDialog(page);

    await page.getByLabel('Lisää joukkue tai turnaus').click();
    await expect(dialog).toBeVisible();
    if (await playerInput.isVisible()) await playerInput.fill('Simo');
    await dialog.getByPlaceholder(/tulospalvelu.palloliitto|.ics-linkki/i).fill('https://export.myclub.fi/calendar/ervi-p12.ics');
    await dialog.getByPlaceholder(/HJK Sininen/i).fill('ErVi P12');
    await dialog.getByRole('button', { name: /Tuo joukkue/i }).click();
    await page.waitForTimeout(1200);
    await shot(page, '06-after-myclub-import');
    if (await dialog.isVisible()) await closeDialog(page);

    await page.getByLabel('Lisää joukkue tai turnaus').click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: /Liitto/i }).click();
    await dialog.getByPlaceholder(/tulospalvelu.palloliitto|.ics-linkki/i).fill('https://tulospalvelu.palloliitto.fi/team/12345/fixture');
    await shot(page, '07-import-palloliitto-url');
    await dialog.getByRole('tab', { name: /WhatsApp/i }).click();
    await shot(page, '08-import-whatsapp');
    await dialog.getByRole('tab', { name: /Excel/i }).click();
    await shot(page, '09-import-excel');
    await dialog.getByRole('tab', { name: /Kuvakaappaus/i }).click();
    await shot(page, '10-import-ocr');
    await closeDialog(page);

    await page.getByRole('tab', { name: /^Kortit$/ }).click();
    await shot(page, '11-cards');
    await page.getByRole('tab', { name: /^Tiivis$/ }).click();
    await shot(page, '12-timeline');
    await page.getByRole('tab', { name: /^Kalenteri$/ }).click();
    await shot(page, '13-calendar');
    await page.getByRole('tab', { name: /^Kortit$/ }).click();

    const attending = page.getByRole('button', { name: /Osallistuu/i }).first();
    if (await attending.isVisible()) {
      await attending.click();
      await shot(page, '14-filter-in');
    }
    const outBtn = page.getByRole('button', { name: /Pois/i }).first();
    if (await outBtn.isVisible()) {
      await outBtn.click();
      await shot(page, '15-filter-out');
    }
    await page.getByRole('button', { name: /^Kaikki/ }).first().click();

    const more = page.getByLabel('Hallitse tapahtumaa').first();
    if (await more.isVisible()) {
      await more.click();
      await page.waitForTimeout(300);
      await shot(page, '16-event-manage');
      await closeDialog(page);
    }
    const chat = page.getByRole('button', { name: /Viestit|Chat|Liitä viesti/i }).first();
    if (await chat.isVisible()) {
      await chat.click();
      await page.waitForTimeout(300);
      await shot(page, '17-event-chat');
      await closeDialog(page);
    }
    const attendToggle = page.getByRole('button', { name: /osallistuu|poisjäänti/i }).first();
    if (await attendToggle.isVisible()) {
      await attendToggle.click();
      await shot(page, '18-attendance-toggle');
    }

    const menuWalk = [
      { label: /Kyytiapuri/i, file: '19-logistics' },
      { label: /Kotiosoite & Kulkuvälineet/i, file: '20-home-location' },
      { label: /Perhe-koodi/i, file: '21-family-share' },
      { label: /Kysy aikataulusta/i, file: '22-copilot' },
      { label: /Asetukset/i, file: '23-settings' }
    ];
    for (const step of menuWalk) {
      await openHudMenu(page);
      const item = page.locator('header').getByRole('button', { name: step.label }).first();
      if (await item.count()) {
        await item.click();
        await page.waitForTimeout(300);
        await shot(page, step.file);
        await closeDialog(page);
      } else {
        await page.keyboard.press('Escape');
      }
    }

    await openHudMenu(page);
    const ambient = page.locator('header').getByRole('button', { name: /Keittiönäyttö/i }).first();
    if (await ambient.count()) {
      await ambient.click();
      await page.waitForTimeout(400);
      await shot(page, '24-ambient');
      const exit = page.getByRole('button', { name: /Poistu|Sulje|Takaisin/i }).first();
      if (await exit.isVisible()) await exit.click();
      else await page.goto('/');
    } else {
      await page.keyboard.press('Escape');
    }
    await shot(page, '26-final');
  });
});
