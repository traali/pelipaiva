import { test, expect } from '@playwright/test';

test.describe('🏆 Pelipäivä End-to-End User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      localStorage.clear();
      const dbs = await window.indexedDB.databases();
      for (const d of dbs) {
        if (d.name) window.indexedDB.deleteDatabase(d.name);
      }
    });
    await page.reload();
  });

  async function enterLocalHud(page: import('@playwright/test').Page) {
    await expect(page.getByRole('heading', { name: /Miten haluat käyttää FamDayta/i })).toBeVisible();
    await page.getByRole('button', { name: /Vain tämä laite/i }).click();
    await page.getByRole('button', { name: /Siirry FamDay-ottelukeskukseen/i }).click();
    await expect(page.getByRole('tab', { name: /Kaikki/i })).toBeVisible();
  }

  test('Flow 1: Onboarding -> Local device -> Dashboard', async ({ page }) => {
    await page.goto('/');
    await enterLocalHud(page);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('Flow 2: Mission Control All-profiles tab', async ({ page }) => {
    await page.goto('/');
    await enterLocalHud(page);
    const allTab = page.getByRole('tab', { name: /Kaikki/i });
    await expect(allTab).toBeVisible();
    await expect(allTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Flow 3: Unified Smart Import Modal & Tabs Navigation', async ({ page }) => {
    await page.goto('/');
    await enterLocalHud(page);

    const addTeamButton = page.getByLabel('Lisää joukkue tai turnaus');
    await expect(addTeamButton).toBeVisible();
    await addTeamButton.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    await expect(modal.getByRole('tab', { name: /Liitto/i })).toBeVisible();
    await expect(modal.getByRole('tab', { name: /WhatsApp/i })).toBeVisible();
    await expect(modal.getByRole('tab', { name: /Excel/i })).toBeVisible();
    await expect(modal.getByRole('tab', { name: /Kuvakaappaus/i })).toBeVisible();

    const whatsappTab = modal.getByRole('tab', { name: /WhatsApp/i });
    await whatsappTab.click();
    await expect(whatsappTab).toHaveAttribute('aria-selected', 'true');
    await expect(modal.getByText(/Liitä valmentajan WhatsApp-viesti/i)).toBeVisible();

    const excelTab = modal.getByRole('tab', { name: /Excel/i });
    await excelTab.click();
    await expect(modal.getByText(/Kopioi taulukko Sheetsistä/i)).toBeVisible();
    await expect(excelTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Flow 4: View Mode Switching', async ({ page }) => {
    await page.goto('/');
    await enterLocalHud(page);

    const cardsButton = page.getByRole('tab', { name: /Kortit/i });
    const timelineButton = page.getByRole('tab', { name: /Tiivis/i });
    const calendarButton = page.getByRole('tab', { name: /Kalenteri/i });

    await expect(cardsButton).toBeVisible();
    await expect(timelineButton).toBeVisible();
    await expect(calendarButton).toBeVisible();

    await timelineButton.click();
    await expect(timelineButton).toHaveAttribute('aria-selected', 'true');

    await calendarButton.click();
    await expect(calendarButton).toHaveAttribute('aria-selected', 'true');

    await cardsButton.click();
    await expect(cardsButton).toHaveAttribute('aria-selected', 'true');
  });

  test('Flow 5: Ask Copilot AI Assistant Interaction', async ({ page }) => {
    await page.goto('/');
    await enterLocalHud(page);

    const moreMenuButton = page.locator('header').getByRole('button', { name: 'Lisää', exact: true });
    await expect(moreMenuButton).toBeVisible();
    await moreMenuButton.click();

    const askMenuItem = page.getByRole('button', { name: /Kysy aikataulusta/i });
    await expect(askMenuItem).toBeVisible();
    await askMenuItem.click();

    const copilotModal = page.locator('div[role="dialog"]');
    await expect(copilotModal).toBeVisible();
    await expect(page.getByText(/Kysy Pelipäivältä/i)).toBeVisible();

    const chip = page.getByRole('button', { name: /kahviovuoroa/i });
    await expect(chip).toBeVisible();
    await chip.click();

    await expect(page.getByText(/Aikataulujärki vastaa/i)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(copilotModal).not.toBeVisible();
  });
});
