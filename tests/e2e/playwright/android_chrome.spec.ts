import { test, expect } from '@playwright/test';

async function enterLocalHud(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await window.indexedDB.databases();
    for (const d of dbs) {
      if (d.name) window.indexedDB.deleteDatabase(d.name);
    }
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /Miten haluat käyttää FamDayta/i })).toBeVisible();
  await page.getByRole('button', { name: /Vain tämä laite/i }).click();
  await page.getByRole('button', { name: /Siirry FamDay-ottelukeskukseen/i }).click();
  await expect(page.getByRole('tab', { name: /Kaikki/i })).toBeVisible();
}

test.describe('Android Chrome + desktop Chrome — family AI + HUD', () => {
  test('onboarding local path reaches dashboard and Perhe tekoäly card', async ({ page }, testInfo) => {
    await enterLocalHud(page);

    await expect(page.getByRole('button', { name: 'Hallitse perheen pelaajia ja joukkueita' })).toBeVisible();
    await page.getByRole('button', { name: 'Hallitse perheen pelaajia ja joukkueita' }).click();

    const dialog = page.getByRole('dialog', { name: /Perheen pelaajat/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Laitteen tekoäly')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Ei käytössä/i })).toBeChecked();

    const chromeRadio = dialog.getByRole('radio', { name: /Chrome Gemini Nano/i });
    const appleRadio = dialog.getByRole('radio', { name: /Apple Intelligence/i });

    await expect(chromeRadio).toBeVisible();
    await expect(appleRadio).toHaveCount(0);
    await expect(dialog.getByTestId('ondevice-llm-summary')).toContainText(/Chrome|Aikataulujärki/i);

    const isAndroid = /Android/i.test(testInfo.project.name);
    if (isAndroid) {
      await expect(dialog.getByTestId('ondevice-llm-summary')).toContainText(/Android Chrome/i);
    }
  });

  test('Copilot answers with Aikataulujärki when neural net is off', async ({ page }) => {
    await enterLocalHud(page);

    const more = page.locator('header').getByRole('button', { name: 'Lisää', exact: true });
    await expect(more).toBeVisible();
    await more.click();
    await page.getByRole('button', { name: /Kysy aikataulusta/i }).click();

    const copilot = page.getByRole('dialog', { name: /Kysy Pelipäivältä/i });
    await expect(copilot).toBeVisible();
    await copilot.getByRole('button', { name: /kahviovuoroa/i }).click();
    await expect(copilot.getByText(/Aikataulujärki vastaa/i)).toBeVisible();
  });

  test('Smart Import opens from + Joukkue on this Chrome', async ({ page }) => {
    await enterLocalHud(page);
    await page.getByLabel('Lisää joukkue tai turnaus').click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('tab', { name: /Liitto/i })).toBeVisible();
    await expect(modal.getByRole('tab', { name: /WhatsApp/i })).toBeVisible();
  });
});
