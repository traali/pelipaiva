import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Every game shows where it is and where to park: map + Parkkis, honest about
 * how well the location is known. Real PPJ/Laru sin TASO games (team 185085),
 * real Parkkis snapshot tile for Lauttasaari; network fallbacks answer empty.
 */
const FIX = path.resolve(process.cwd(), 'tests/fixtures');
const seed = JSON.parse(fs.readFileSync(path.join(FIX, 'json/e2e-venue-map-ppj-laru-2026-11-14.json'), 'utf-8'));
const tile = fs.readFileSync(path.join(FIX, 'json/parkkis-tile-1243_6016-2026-11-12.json'), 'utf-8');
const blankPng = fs.readFileSync(path.join(FIX, 'blank-tile.png'));

async function mockNetwork(page: Page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost')) return route.continue();
    if (url.includes('tile.openstreetmap.org')) return route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
    if (url.includes('parkkis.pages.dev/data/manifest.json'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ generated_at: '2026-11-12T11:03:31.324Z' }) });
    if (url.includes('parkkis.pages.dev/data/tiles/1243_6016.json'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: tile });
    if (url.includes('parkkis.pages.dev/data/tiles/'))
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' });
    if (url.includes('api.lipas.fi'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"pagination":{"total-pages":1}}' });
    if (url.includes('servicemap')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
    if (url.includes('photon.komoot.io')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"features":[]}' });
    return route.abort();
  });
}

async function seedDb(page: Page) {
  await page.evaluate(async (data) => {
    localStorage.setItem('pelipaiva_onboarding_done', 'true');
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const q = indexedDB.open('PelipaivaDB');
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['profiles', 'events'], 'readwrite');
      for (const p of data.profiles) tx.objectStore('profiles').put(p);
      for (const e of data.events) tx.objectStore('events').put(e);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, seed);
}

test.describe('Game venue map and parking', () => {
  test.beforeEach(async ({ page }) => {
    // Two days before PPJ/Laru sin – EPS/Punainen at Lauttasaari TN B (24.9.2026).
    await page.clock.setFixedTime(new Date('2026-09-22T12:00:00+03:00'));
    await mockNetwork(page);
    await page.goto('/');
    await page.waitForFunction(async () => (await indexedDB.databases()).some((d) => d.name === 'PelipaivaDB'));
    await seedDb(page);
    await page.reload();
    const all = page.getByText('Kaikki päivät');
    await all.first().click();
  });

  test('next game in the list shows map, Parkkis and nearby parking with its date', async ({ page }) => {
    const card = page.locator('[data-testid=venue-map-card]').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-location-status', 'exact');
    await expect(card.getByTestId('venue-location-label')).toHaveText('Sijainti: Lauttasaari TN B (tulospalvelu)');
    await expect(card.getByTestId('venue-map-pin')).toBeVisible();
    await expect(card.getByTestId('venue-map-link')).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=60.163574,24.867502'
    );
    await expect(card.getByTestId('parkkis-link')).toHaveAttribute(
      'href',
      'https://parkkis.pages.dev/venue/Lauttasaari%20TN%20B?lat=60.163573520062&lon=24.867501722732'
    );
    await expect(card.getByTestId('parkkis-nearby')).toContainText('Sallittu pysäköinti 300 m säteellä:');
    await expect(card.getByTestId('parkkis-nearby')).toContainText('Parkkis-tieto 12.11.');
    const box = await card.getByTestId('parkkis-link').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('approximate and unknown locations are labelled honestly', async ({ page }) => {
    const approx = page.locator('[data-testid=venue-quick-links]').filter({
      has: page.locator('[aria-label*="Arvioitu sijainti"]')
    });
    await expect(approx.first()).toBeVisible();
    await expect(approx.first().getByTestId('venue-quick-parkkis')).toHaveAttribute('aria-label', /sijainti arvioitu/);

    const search = page.getByRole('link', { name: 'Hae kartalta: Matinkylän Urheilupuisto TN 2 B, Espoo' });
    await expect(search.first()).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Matinkyl%C3%A4n%20Urheilupuisto%20TN%202%20B%2C%20Espoo'
    );
    for (const a of await page.getByTestId('venue-quick-map').all()) {
      const b = await a.boundingBox();
      expect(b!.width).toBeGreaterThanOrEqual(44);
      expect(b!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('game detail view shows the map and parking', async ({ page }) => {
    await page.getByText('PPJ/Laru sin vs EPS/Punainen').first().click();
    const dlg = page.getByRole('dialog').getByTestId('venue-map-card');
    await expect(dlg).toBeVisible();
    await expect(dlg.getByTestId('parkkis-link')).toBeVisible();
    await expect(dlg.getByTestId('venue-directions')).toHaveAttribute('href', /destination=60\.163574,24\.867502/);
  });
});
