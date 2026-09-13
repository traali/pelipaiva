import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOT_DIR = path.resolve(process.cwd(), 'screenshots/smoke');

function helsinkiIso(y: number, m: number, d: number, hh: number, mm: number): string {
  const utc = Date.UTC(y, m - 1, d, hh - 3, mm, 0);
  return new Date(utc).toISOString();
}

const venue = {
  name: 'Lauttasaari TN B',
  normalizedName: 'lauttasaari tn b',
  city: 'Helsinki',
  coordinates: { lat: 60.159, lng: 24.877 },
  isIndoor: false,
  surface: 'artificial_turf_3g',
  hasFloodlights: true
};

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
  await expect(page.getByRole('heading', { name: /Miten haluat käyttää FamDayta/i })).toBeVisible({
    timeout: 20_000
  });
  await page.getByRole('button', { name: /Vain tämä laite/i }).click();
  await page.getByRole('button', { name: /Siirry FamDay-ottelukeskukseen/i }).click();
  await expect(page.getByRole('tab', { name: /Kaikki/i }).first()).toBeVisible({ timeout: 20_000 });
}

async function seedFamilyEvents(page: Page) {
  const kickoff = helsinkiIso(2026, 9, 15, 18, 0);
  const warmup = helsinkiIso(2026, 9, 15, 17, 30);
  const end = helsinkiIso(2026, 9, 15, 19, 30);
  const overlapStart = helsinkiIso(2026, 9, 15, 17, 45);
  const overlapEnd = helsinkiIso(2026, 9, 15, 19, 0);
  const trainingStart = helsinkiIso(2026, 9, 16, 17, 0);
  const trainingEnd = helsinkiIso(2026, 9, 16, 18, 30);
  const outStart = helsinkiIso(2026, 9, 17, 18, 0);
  const outEnd = helsinkiIso(2026, 9, 17, 19, 30);

  await page.evaluate(
    async (payload) => {
      const briefing = (departure: string, conflict?: string) => ({
        scoutSummary: 'Test sparri',
        gearAndPackingAdvice: {
          clothing: 'Verkkarit',
          footwear: 'AG_ARTIFICIAL_GRASS',
          footwearReason: 'Tekonurmi',
          kitRecommendation: 'Musta paita',
          spectatorGear: 'Takki'
        },
        recommendedDepartureTime: departure,
        departureCountdownMinutes: 90,
        conflictWarning: conflict,
        postMatchWhatsAppTemplate: 'Kiitos pelistä'
      });

      await new Promise((resolve, reject) => {
        const open = indexedDB.open('PelipaivaDB');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['profiles', 'events'], 'readwrite');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          const profiles = tx.objectStore('profiles');
          const events = tx.objectStore('events');
          profiles.put({
            id: 'profile-simo-ppj',
            playerName: 'Simo',
            teamName: 'PPJ/Laru mus',
            sport: 'football',
            primaryColor: 'musta',
            calendarUrl: '',
            colorHex: '#3b82f6'
          });
          profiles.put({
            id: 'profile-arto-hps',
            playerName: 'Arto',
            teamName: 'HPS/Valkoinen 2',
            sport: 'football',
            primaryColor: 'valkoinen',
            calendarUrl: '',
            colorHex: '#f59e0b'
          });
          events.put({
            id: 'evt-mismatch-ppj',
            profileId: 'profile-simo-ppj',
            sport: 'football',
            eventType: 'match',
            isTraining: false,
            title: 'PPJ/Laru mus vs HPS/Valkoinen 2',
            homeTeam: 'PPJ/Laru mus',
            awayTeam: 'HPS/Valkoinen 2',
            isHomeMatch: true,
            startTime: payload.kickoff,
            endTime: payload.end,
            warmupTime: payload.warmup,
            venue: payload.venue,
            attendanceStatus: 'in',
            officialFixtureId: 'fix-ppj-1',
            reconciliationStatus: 'conflict_mismatch',
            briefing: briefing(
              payload.warmup,
              '⚠️ AIKATAULURUUHKI: Menee päällekkäin tapahtuman "PPJ Laru 2013: Piirisarja - ORANSSI" kanssa!'
            ),
            mismatchFlags: {
              timeMismatch: true,
              timeDiffMinutes: 30,
              calendarStartTime: '17.30',
              officialStartTime: '18.00',
              officialStartTimeIso: payload.kickoff,
              venueMismatch: false
            }
          });
          events.put({
            id: 'evt-overlap-oranssi',
            profileId: 'profile-arto-hps',
            sport: 'football',
            eventType: 'match',
            isTraining: false,
            title: 'PPJ Laru 2013: Piirisarja - ORANSSI',
            homeTeam: 'PPJ Laru 2013',
            awayTeam: 'ORANSSI',
            isHomeMatch: false,
            startTime: payload.overlapStart,
            endTime: payload.overlapEnd,
            warmupTime: payload.overlapStart,
            venue: { ...payload.venue, name: 'Tali TN' },
            attendanceStatus: 'in',
            briefing: briefing(payload.overlapStart)
          });
          events.put({
            id: 'evt-training',
            profileId: 'profile-simo-ppj',
            sport: 'football',
            eventType: 'training',
            isTraining: true,
            title: 'PPJ/Laru mus treeni',
            homeTeam: 'PPJ/Laru mus',
            awayTeam: '',
            isHomeMatch: true,
            startTime: payload.trainingStart,
            endTime: payload.trainingEnd,
            warmupTime: payload.trainingStart,
            venue: payload.venue,
            attendanceStatus: 'in',
            briefing: briefing(payload.trainingStart)
          });
          events.put({
            id: 'evt-out',
            profileId: 'profile-simo-ppj',
            sport: 'football',
            eventType: 'match',
            isTraining: false,
            title: 'PPJ/Laru mus vs KäPa',
            homeTeam: 'PPJ/Laru mus',
            awayTeam: 'KäPa',
            isHomeMatch: false,
            startTime: payload.outStart,
            endTime: payload.outEnd,
            warmupTime: payload.outStart,
            venue: payload.venue,
            attendanceStatus: 'out',
            briefing: briefing(payload.outStart)
          });
        };
      });
    },
    { kickoff, warmup, end, overlapStart, overlapEnd, trainingStart, trainingEnd, outStart, outEnd, venue }
  );

  await page.reload();
  await expect(page.getByRole('tab', { name: /Kaikki/i }).first()).toBeVisible({ timeout: 20_000 });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
}

test.describe('Smoke: seed events and click through UI', () => {
  test.describe.configure({ mode: 'serial' });

  test('seed + click filters, views, mismatch banner, attendance', async ({ page }) => {
    test.setTimeout(120_000);
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await resetClient(page);
    await shot(page, '01-onboarding.png');
    await enterLocalHud(page);
    await shot(page, '02-empty-hud.png');
    await seedFamilyEvents(page);
    await page.waitForTimeout(800);
    await expect(page.getByText(/PPJ\/Laru mus/i).first()).toBeVisible({ timeout: 20_000 });
    await shot(page, '03-seeded-cards.png');
    const cardsTab = page.getByRole('tab', { name: /^Kortit$/ });
    const timelineTab = page.getByRole('tab', { name: /^Tiivis$/ });
    const calendarTab = page.getByRole('tab', { name: /^Kalenteri$/ });
    await expect(cardsTab).toBeVisible();
    await timelineTab.click();
    await expect(timelineTab).toHaveAttribute('aria-selected', 'true');
    await shot(page, '04-timeline.png');
    await calendarTab.click();
    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
    await shot(page, '05-calendar.png');
    await cardsTab.click();
    await expect(cardsTab).toHaveAttribute('aria-selected', 'true');
    const attending = page.getByRole('button', { name: /Osallistuu/i }).first();
    if (await attending.isVisible()) {
      await attending.click();
      await page.waitForTimeout(200);
      await shot(page, '06-filter-attending.png');
    }
    const outFilter = page.getByRole('button', { name: /Pois/i }).first();
    if (await outFilter.isVisible()) {
      await outFilter.click();
      await page.waitForTimeout(200);
      await expect(page.getByText(/KäPa|Poisjäänti|Osallistuu silti/i).first()).toBeAttached();
      await shot(page, '07-filter-out.png');
      await page.getByRole('button', { name: /^Kaikki/ }).first().click();
    }
    await cardsTab.click();
    const banner = page.getByText(/AIKATAULURUUHKI|Aikataulu eroaa|Aikataulumuutos/i).first();
    if (await banner.isVisible()) {
      await shot(page, '08-mismatch-banner.png');
      const adopt = page.getByRole('button', { name: /Päivitä liiton tietoon/i }).first();
      if (await adopt.isVisible()) {
        await adopt.scrollIntoViewIfNeeded();
        await adopt.click({ force: true });
        await page.waitForTimeout(700);
        await shot(page, '09-after-adopt-official.png');
      }
      const hide = page.getByRole('button', { name: /^Piilota$/ }).first();
      if (await hide.isVisible()) {
        await hide.click();
        await page.waitForTimeout(400);
      }
    } else {
      await shot(page, '08-mismatch-banner.png');
    }
    const attendBtn = page.getByRole('button', { name: /osallistuu|poisjäänti/i }).first();
    if (await attendBtn.isVisible()) {
      await attendBtn.click();
      await page.waitForTimeout(300);
      await shot(page, '10-after-attendance-toggle.png');
    }
    const addTeam = page.getByLabel('Lisää joukkue tai turnaus');
    await addTeam.click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await shot(page, '11-add-team-modal.png');
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    const profileSimo = page.getByRole('tab', { name: /Simo/i }).first();
    if (await profileSimo.isVisible()) {
      await profileSimo.click();
      await shot(page, '12-profile-simo.png');
    }
    await page.getByRole('tab', { name: /Kaikki/i }).first().click();
    await shot(page, '13-final-all.png');
  });
});
