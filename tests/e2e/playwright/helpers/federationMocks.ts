import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES = path.resolve(process.cwd(), 'tests/fixtures');

function read(category: 'ics' | 'html' | 'json', name: string): string {
  return fs.readFileSync(path.join(FIXTURES, category, name), 'utf-8');
}

export function futurizeIcs(ics: string): string {
  const days = ['20260915', '20260916', '20260917', '20260918', '20260919', '20260920', '20260921'];
  const seen = new Map<string, string>();
  let i = 0;
  return ics.replace(/(\d{8})(T\d{6}Z)/g, (_m, day: string, time: string) => {
    if (!seen.has(day)) {
      seen.set(day, days[i % days.length]!);
      i += 1;
    }
    return `${seen.get(day)}${time}`;
  });
}

export function nimenhuutoIcs(): string {
  return futurizeIcs(read('ics', 'nimenhuuto_hjk_multisquad.ics'));
}
export function myclubIcs(): string {
  return futurizeIcs(read('ics', 'myclub_ervi_talkoovahti.ics'));
}
export function torneopalVolleyballIcs(): string {
  return futurizeIcs(read('ics', 'torneopal_puma_volleyball.ics'));
}

function icsResponse(body: string) {
  return { status: 200, contentType: 'text/calendar; charset=utf-8', body };
}
function htmlResponse(filename: string) {
  return { status: 200, contentType: 'text/html; charset=utf-8', body: read('html', filename) };
}

export async function installFederationMocks(page: Page): Promise<void> {
  const patterns = [
    '**/api/proxy/**',
    '**/*nimenhuuto*',
    '**/*myclub*',
    '**/*torneopal*',
    '**/*palloliitto*',
    '**/*salibandy*',
    '**/*basket.fi*',
    '**/*lipas*',
    '**/*fmi*'
  ];

  const handler: Parameters<Page['route']>[1] = async (route) => {
    const reqUrl = route.request().url();
    if (reqUrl.includes('localhost') || reqUrl.includes('127.0.0.1')) {
      return route.continue();
    }
    let target = reqUrl;
    try {
      const nested = new URL(reqUrl).searchParams.get('url');
      if (nested) target = nested;
    } catch {
      /* keep */
    }
    const lower = target.toLowerCase();
    if (lower.includes('nimenhuuto')) return route.fulfill(icsResponse(nimenhuutoIcs()));
    if (lower.includes('myclub')) return route.fulfill(icsResponse(myclubIcs()));
    if (lower.includes('torneopal') && (lower.includes('.ics') || lower.includes('ical') || lower.includes('calendar'))) {
      return route.fulfill(icsResponse(torneopalVolleyballIcs()));
    }
    if (lower.includes('palloliitto')) return route.fulfill(htmlResponse('palloliitto_team_page.html'));
    if (lower.includes('salibandy')) return route.fulfill(htmlResponse('salibandy_team_page.html'));
    if (lower.includes('basket.fi')) return route.fulfill(htmlResponse('basket_fi_team_page.html'));
    if (lower.includes('torneopal.fi')) return route.fulfill(htmlResponse('torneopal_taso_team_page.html'));
    if (lower.includes('lipas')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: read('json', 'lipas_venues_sample.json') });
    }
    if (lower.includes('fmi') || lower.includes('/weather')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: read('json', 'fmi_weather_sample.json') });
    }
    return route.continue();
  };

  for (const pattern of patterns) {
    await page.route(pattern, handler);
  }
}
