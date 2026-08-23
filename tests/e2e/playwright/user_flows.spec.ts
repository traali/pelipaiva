import { test, expect } from '@playwright/test';

test.describe('🏆 Pelipäivä End-to-End User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and IndexedDB before each test to start in a clean state
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

  test('Flow 1: Onboarding -> Activate Demo Schedule -> Dashboard Hero Card', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Onboarding Wizard heading is visible on first launch
    const onboardingHeading = page.getByRole('heading', { name: /Perheen kalenteriasetus/i });
    await expect(onboardingHeading).toBeVisible();

    // 2. Click demo seed button
    const demoButton = page.getByRole('button', { name: /esimerkkidata/i }).first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // 3. Verify Dashboard Mission Control mounts
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Kaikki/i })).toBeVisible();

    // 4. Verify match cards or feed are rendered
    await expect(page.locator('main')).toBeVisible();
  });

  test('Flow 2: Child Profile Filter & Mission Control Scoping', async ({ page }) => {
    await page.goto('/');
    const demoButton = page.getByRole('button', { name: /esimerkkidata/i }).first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for Dashboard to mount with All Profiles tab
    const allTab = page.getByRole('tab', { name: /Kaikki/i });
    await expect(allTab).toBeVisible();
    await expect(allTab).toHaveAttribute('aria-selected', 'true');

    // Switch to a child profile tab (e.g. Simo or Aada)
    const profileTabs = page.locator('nav[aria-label="Pelaaja- ja joukkueprofiilit"] button[role="tab"]');
    await expect(profileTabs.nth(1)).toBeVisible();

    const secondTab = profileTabs.nth(1);
    await secondTab.scrollIntoViewIfNeeded();
    await secondTab.click();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
    await expect(allTab).toHaveAttribute('aria-selected', 'false');

    // Switch back to "Kaikki"
    await allTab.scrollIntoViewIfNeeded();
    await allTab.click();
    await expect(allTab).toHaveAttribute('aria-selected', 'true');
    await expect(secondTab).toHaveAttribute('aria-selected', 'false');
  });

  test('Flow 3: Unified Smart Import Modal & Tabs Navigation', async ({ page }) => {
    await page.goto('/');
    const demoButton = page.getByRole('button', { name: /esimerkkidata/i }).first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for dashboard
    await expect(page.getByRole('tab', { name: /Kaikki/i })).toBeVisible();

    // Open Smart Import modal via "+ Joukkue" button
    const addTeamButton = page.getByLabel('Lisää joukkue tai turnaus');
    await expect(addTeamButton).toBeVisible();
    await addTeamButton.click();

    // Verify modal is open
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Verify all 4 tabs exist in modal
    await expect(modal.getByRole('tab', { name: /Liitto/i })).toBeVisible();
    await expect(modal.getByRole('tab', { name: /WhatsApp/i })).toBeVisible();
    await expect(modal.getByRole('tab', { name: /Excel/i })).toBeVisible();
    await expect(modal.getByRole('tab', { name: /Kuvakaappaus/i })).toBeVisible();

    // Switch to WhatsApp tab
    const whatsappTab = modal.getByRole('tab', { name: /WhatsApp/i });
    await whatsappTab.click();
    await expect(whatsappTab).toHaveAttribute('aria-selected', 'true');
    await expect(modal.getByText(/Liitä valmentajan WhatsApp-viesti/i)).toBeVisible();

    // Switch to Excel / Sheets tab
    const excelTab = modal.getByRole('tab', { name: /Excel/i });
    await excelTab.click();
    await expect(modal.getByText(/Kopioi taulukko Sheetsistä/i)).toBeVisible();
    await expect(excelTab).toHaveAttribute('aria-selected', 'true');

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Flow 4: View Mode Switching & Collapsible Past Events', async ({ page }) => {
    await page.goto('/');
    const demoButton = page.getByRole('button', { name: /esimerkkidata/i }).first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for dashboard
    await expect(page.getByRole('tab', { name: /Kaikki/i })).toBeVisible();

    // Verify View Mode buttons
    const cardsButton = page.getByRole('tab', { name: /Kortit/i });
    const timelineButton = page.getByRole('tab', { name: /Tiivis/i });
    const calendarButton = page.getByRole('tab', { name: /Kalenteri/i });

    await expect(cardsButton).toBeVisible();
    await expect(timelineButton).toBeVisible();
    await expect(calendarButton).toBeVisible();

    // Switch to Timeline
    await timelineButton.click();
    await expect(timelineButton).toHaveAttribute('aria-selected', 'true');

    // Switch to Calendar Grid
    await calendarButton.click();
    await expect(calendarButton).toHaveAttribute('aria-selected', 'true');

    // Switch back to Cards
    await cardsButton.click();
    await expect(cardsButton).toHaveAttribute('aria-selected', 'true');
  });

  test('Flow 5: Ask Copilot AI Assistant Interaction', async ({ page }) => {
    await page.goto('/');
    const demoButton = page.getByRole('button', { name: /esimerkkidata/i }).first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for dashboard
    await expect(page.getByRole('tab', { name: /Kaikki/i })).toBeVisible();

    // Click More Actions in HUD header
    const moreMenuButton = page.locator('header').getByRole('button', { name: 'Lisää', exact: true });
    await expect(moreMenuButton).toBeVisible();
    await moreMenuButton.click();

    // Click "Kysy aikataulusta" in dropdown menu
    const askMenuItem = page.getByRole('button', { name: /Kysy aikataulusta/i });
    await expect(askMenuItem).toBeVisible();
    await askMenuItem.click();

    // Verify Ask Copilot modal opens
    const copilotModal = page.locator('div[role="dialog"]');
    await expect(copilotModal).toBeVisible();
    await expect(page.getByText(/Kysy Pelipäivältä/i)).toBeVisible();

    // Click suggestion chip for volunteer duties
    const chip = page.getByRole('button', { name: /kahviovuoroa/i });
    await expect(chip).toBeVisible();
    await chip.click();

    // Verify response box appears
    await expect(page.getByText(/Pelipäivä Äly vastaa/i)).toBeVisible();

    // Close via Escape key
    await page.keyboard.press('Escape');
    await expect(copilotModal).not.toBeVisible();
  });
});
