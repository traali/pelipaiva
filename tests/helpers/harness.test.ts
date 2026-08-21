/**
 * Harness Verification Test Suite
 * 
 * Verifies that:
 * 1. setupDexie creates isolated in-memory test databases and handles CRUD operations smoothly.
 * 2. fixtureLoader correctly loads ICS, HTML, and JSON test fixtures.
 * 3. mockFetch correctly intercepts sports association, LIPAS, weather, and ICS requests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, clearTestDb, deleteTestDb } from './setupDexie';
import {
  loadFixtureIcs,
  loadFixtureHtml,
  loadFixtureJson,
  listFixtures,
  loadAllIcsFixtures,
  loadAllHtmlFixtures,
  loadAllJsonFixtures
} from './fixtureLoader';
import { MockFetchManager, installMockFetch, uninstallMockFetch } from './mockFetch';
import { parseICSFeed } from '../../src/lib/calendar/icsParser';
import { MatchdayEvent, PlayerProfile } from '../../src/types/matchday';

describe('Test Harness & Helper Infrastructure', () => {
  describe('setupDexie & In-Memory Database', () => {
    it('creates an isolated test database and performs basic CRUD', async () => {
      const testDb = createTestDb();
      expect(testDb).toBeDefined();

      const profile: PlayerProfile = {
        id: 'prof_test_1',
        playerName: 'Minea Testi',
        teamName: 'HJK T13 Sininen',
        sport: 'football',
        primaryColor: 'sininen',
        calendarUrl: 'https://nimenhuuto.com/test.ics',
        colorHex: '#003399'
      };

      await testDb.profiles.add(profile);
      const retrieved = await testDb.profiles.get('prof_test_1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.playerName).toBe('Minea Testi');
      expect(retrieved?.teamName).toBe('HJK T13 Sininen');

      await clearTestDb(testDb);
      const count = await testDb.profiles.count();
      expect(count).toBe(0);

      await deleteTestDb(testDb);
    });

    it('handles multi-table operations and indexed queries', async () => {
      const testDb = createTestDb();

      const sampleEvent: MatchdayEvent = {
        id: 'evt_101',
        profileId: 'prof_hjk',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK T13 Sininen vs EPS',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'EPS',
        isHomeMatch: true,
        startTime: '2026-05-16T12:00:00Z',
        endTime: '2026-05-16T13:45:00Z',
        warmupTime: '2026-05-16T11:15:00Z',
        venue: {
          name: 'Bubu tekonurmi',
          normalizedName: 'töölön pallokenttä 6',
          coordinates: { lat: 60.1874, lng: 24.9288 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      };

      await testDb.events.add(sampleEvent);
      const events = await testDb.events.where('profileId').equals('prof_hjk').toArray();
      expect(events.length).toBe(1);
      expect(events[0].title).toBe('HJK T13 Sininen vs EPS');

      await deleteTestDb(testDb);
    });
  });

  describe('fixtureLoader', () => {
    it('loads all 5 required ICS fixtures', () => {
      const icsFiles = [
        'nimenhuuto_hjk_multisquad',
        'myclub_ervi_talkoovahti',
        'jopox_honka_warmup_kickoff',
        'torneopal_puma_volleyball',
        'dst_fall_spring_transitions'
      ];

      for (const name of icsFiles) {
        const content = loadFixtureIcs(name);
        expect(content).toBeDefined();
        expect(content).toContain('BEGIN:VCALENDAR');
        expect(content).toContain('END:VCALENDAR');
      }
    });

    it('loads all 4 required HTML association fixtures', () => {
      const htmlFiles = [
        'palloliitto_team_page',
        'salibandy_team_page',
        'basket_fi_team_page',
        'torneopal_taso_team_page'
      ];

      for (const name of htmlFiles) {
        const content = loadFixtureHtml(name);
        expect(content).toBeDefined();
        expect(content).toContain('<!DOCTYPE html>');
        expect(content).toContain('</html>');
      }
    });

    it('loads all required JSON fixtures', () => {
      const lipas = loadFixtureJson<any[]>('lipas_venues_sample');
      expect(Array.isArray(lipas)).toBe(true);
      expect(lipas.length).toBeGreaterThanOrEqual(5);
      expect(lipas[0].sportsPlaceId).toBeDefined();

      const fmi = loadFixtureJson<any>('fmi_weather_sample');
      expect(fmi.temperatureC).toBeDefined();
      expect(Array.isArray(fmi.rainTimeline)).toBe(true);
    });

    it('lists fixtures and batch loads collections', () => {
      const icsList = listFixtures('ics');
      expect(icsList.length).toBeGreaterThanOrEqual(5);

      const allIcs = loadAllIcsFixtures();
      expect(Object.keys(allIcs).length).toBeGreaterThanOrEqual(5);
      expect(allIcs.nimenhuuto_hjk_multisquad).toBeDefined();

      const allHtml = loadAllHtmlFixtures();
      expect(Object.keys(allHtml).length).toBeGreaterThanOrEqual(4);

      const allJson = loadAllJsonFixtures();
      expect(Object.keys(allJson).length).toBeGreaterThanOrEqual(2);
    });

    it('throws descriptive error on non-existent fixture', () => {
      expect(() => loadFixtureIcs('non_existent_calendar')).toThrow(
        /ICS fixture not found/
      );
    });
  });

  describe('mockFetch', () => {
    let fetchManager: MockFetchManager;

    beforeEach(() => {
      fetchManager = new MockFetchManager();
    });

    it('intercepts Palloliitto team URL requests', async () => {
      const res = await fetchManager.fetch('https://tulospalvelu.palloliitto.fi/team/60341');
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('HJK T13 Sininen');
      expect(text).toContain('fixtures-table');
    });

    it('intercepts Salibandyliitto team URL requests', async () => {
      const res = await fetchManager.fetch('https://tulospalvelu.salibandy.fi/team/45210');
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('EräViikingit P12 Musta');
    });

    it('intercepts Basket.fi team URL requests', async () => {
      const res = await fetchManager.fetch('https://basket.fi/basket/sarjat/joukkue/?team_id=12894');
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Tapiolan Honka Green U14');
    });

    it('intercepts Torneopal team URL requests', async () => {
      const res = await fetchManager.fetch('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=88123');
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('PuMa Volley N2');
    });

    it('intercepts LIPAS and FMI requests', async () => {
      const lipasRes = await fetchManager.fetch('https://lipas.cc.jyu.fi/api/sports-places/504101');
      expect(lipasRes.status).toBe(200);
      const lipasData = await lipasRes.json();
      expect(Array.isArray(lipasData)).toBe(true);

      const fmiRes = await fetchManager.fetch('https://opendata.fmi.fi/wfs?service=WFS&request=getFeature');
      expect(fmiRes.status).toBe(200);
      const fmiData = await fmiRes.json();
      expect(fmiData.temperatureC).toBeDefined();
    });

    it('tracks call history and supports custom routes', async () => {
      fetchManager.mockRoute('https://custom-api.fi/test', { success: true, count: 42 });

      const res = await fetchManager.fetch('https://custom-api.fi/test');
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(42);

      const history = fetchManager.getCallHistory();
      expect(history.length).toBe(1);
      expect(history[0].url).toBe('https://custom-api.fi/test');

      fetchManager.clearHistory();
      expect(fetchManager.getCallHistory().length).toBe(0);
    });

    it('installs and uninstalls onto globalThis.fetch', async () => {
      const manager = installMockFetch();
      const res = await fetch('https://tulospalvelu.palloliitto.fi/team/60341');
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('HJK T13 Sininen');

      uninstallMockFetch();
    });
  });

  describe('Integration: ICS Fixture Parsing & Dexie Storage', () => {
    it('parses nimenhuuto_hjk_multisquad fixture and persists to test database', async () => {
      const icsData = loadFixtureIcs('nimenhuuto_hjk_multisquad');
      const parsedEvents = await parseICSFeed(icsData, 'prof_hjk_integration', 'football');

      expect(parsedEvents.length).toBeGreaterThanOrEqual(4);

      const testDb = createTestDb();
      for (const evt of parsedEvents) {
        await testDb.events.add(evt);
      }

      const storedEvents = await testDb.events
        .where('profileId')
        .equals('prof_hjk_integration')
        .toArray();

      expect(storedEvents.length).toBe(parsedEvents.length);
      const titles = storedEvents.map(e => e.title);
      expect(titles.some(t => t.includes('Sininen vs EPS'))).toBe(true);
      expect(titles.some(t => t.includes('Valkoinen vs FC Espoo'))).toBe(true);

      await deleteTestDb(testDb);
    });
  });
});
