import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseAssociationUrl } from '../../../src/lib/api/associationUrlParser';
import { fetchOfficialTeamData } from '../../../src/lib/api/associationExtractor';
import { parseICSFeed, splitICSBySquad, detectSquadGroups } from '../../../src/lib/calendar/icsParser';
import { reconcileCalendarWithOfficial } from '../../../src/lib/reconciliation/reconciliationEngine';
import {
  PelipaivaDB,
  saveOfficialTeamData,
  saveArrivalRules,
  getOfficialFixtures,
  getArrivalRules
} from '../../../src/lib/storage/db';
import { createTestDb } from '../../helpers/setupDexie';
import { loadIcsFixture } from '../../helpers/fixtureLoader';
import { createMockFetch } from '../../helpers/mockFetch';
import { ArrivalRules, PlayerProfile } from '../../../src/types/matchday';

describe('Feature 19: UI Integration & Onboarding/Import Flow', () => {
  let testDb: PelipaivaDB;
  const mockFetch = createMockFetch();

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('should execute full end-to-end onboarding import flow: URL parse -> fetch fixtures -> parse ICS -> reconcile -> persist', async () => {
    // 1. Parse Association URL
    const rawAssocUrl = 'https://tulospalvelu.palloliitto.fi/team/60341';
    const parsedUrl = parseAssociationUrl(rawAssocUrl);
    expect(parsedUrl).not.toBeNull();
    expect(parsedUrl?.association).toBe('palloliitto');
    expect(parsedUrl?.teamId).toBe('60341');

    // 2. Fetch Official Team Data
    const officialData = await fetchOfficialTeamData(parsedUrl!, mockFetch as unknown as typeof fetch);
    expect(officialData.fixtures.length).toBeGreaterThanOrEqual(4);
    expect(officialData.standings).toBeDefined();

    // 3. Import Multi-Squad ICS Calendar
    const rawICS = loadIcsFixture('nimenhuuto_hjk_multisquad.ics');
    const detectedSquads = detectSquadGroups(rawICS);
    expect(detectedSquads.map((s) => s.squadName)).toContain('Sininen');

    // 4. Filter by Squad 'Sininen'
    const sininenICS = splitICSBySquad(rawICS, 'Sininen');
    const profileId = 'prof-hjk-sininen';
    const calendarEvents = await parseICSFeed(sininenICS, profileId, 'football');
    expect(calendarEvents.length).toBeGreaterThanOrEqual(1);

    // 5. Reconcile Calendar Events with Official Fixtures
    const reconciliationMap = reconcileCalendarWithOfficial(calendarEvents, officialData.fixtures);
    expect(reconciliationMap.size).toBe(calendarEvents.length);

    // Attach reconciliation status to events
    for (const event of calendarEvents) {
      const rec = reconciliationMap.get(event.id);
      if (rec && rec.status === 'auto_matched' && rec.officialFixture) {
        event.officialFixtureId = rec.officialFixture.id;
        event.reconciliationStatus = rec.status;
        event.confidenceScore = rec.confidenceScore;
      }
    }

    // 6. Configure & Save Arrival Rules
    const arrivalRules: ArrivalRules = {
      profileId,
      defaultSport: 'football',
      warmupOffsetsMinutes: {
        homeMatch: 45,
        awayMatch: 60,
        training: 15,
        tournament: 30
      },
      departureBufferMinutes: 15,
      squadAliases: ['Sininen', 'T13 Sininen']
    };

    // 7. Persist Profile, Events, Official Data, and Rules to Dexie
    const profile: PlayerProfile = {
      id: profileId,
      playerName: 'Maija',
      teamName: 'HJK T13 Sininen',
      sport: 'football',
      primaryColor: 'sininen',
      calendarUrl: 'https://nimenhuuto.com/hjk-t13.ics',
      colorHex: '#0055A5',
      associationUrl: parsedUrl?.canonicalUrl,
      associationType: parsedUrl?.association,
      teamId: parsedUrl?.teamId,
      squadName: 'Sininen'
    };

    await testDb.profiles.put(profile);
    await testDb.events.bulkPut(calendarEvents);
    await saveOfficialTeamData(officialData, testDb);
    await saveArrivalRules(arrivalRules, testDb);

    // 8. Verify Complete Persistence & Querying
    const savedProfile = await testDb.profiles.get(profileId);
    expect(savedProfile?.playerName).toBe('Maija');
    expect(savedProfile?.teamId).toBe('60341');

    const savedEvents = await testDb.events.where('profileId').equals(profileId).toArray();
    expect(savedEvents.length).toBe(calendarEvents.length);

    const savedFixtures = await getOfficialFixtures('60341', testDb);
    expect(savedFixtures.length).toBeGreaterThanOrEqual(4);

    const savedRules = await getArrivalRules(profileId, testDb);
    expect(savedRules?.squadAliases).toContain('Sininen');
  });

  it('should handle onboarding import for Salibandyliitto teams', async () => {
    const rawUrl = 'https://tulospalvelu.salibandy.fi/team/45210';
    const parsedUrl = parseAssociationUrl(rawUrl)!;
    const officialData = await fetchOfficialTeamData(parsedUrl, mockFetch as unknown as typeof fetch);

    expect(officialData.association).toBe('salibandy');
    expect(officialData.fixtures.length).toBeGreaterThanOrEqual(3);

    const icsContent = loadIcsFixture('myclub_ervi_talkoovahti.ics');
    const events = await parseICSFeed(icsContent, 'prof-ervi-p12', 'floorball');

    const recMap = reconcileCalendarWithOfficial(events, officialData.fixtures);
    expect(recMap.size).toBe(events.length);
  });

  it('should handle onboarding import for Basket.fi teams', async () => {
    const rawUrl = 'https://basket.fi/basket/sarjat/joukkue/?team_id=12894';
    const parsedUrl = parseAssociationUrl(rawUrl)!;
    const officialData = await fetchOfficialTeamData(parsedUrl, mockFetch as unknown as typeof fetch);

    expect(officialData.association).toBe('basket');
    expect(officialData.sport).toBe('basketball');
    expect(officialData.fixtures.length).toBeGreaterThanOrEqual(3);
    expect(officialData.standings?.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle onboarding import for Torneopal volleyball teams with set scores', async () => {
    const rawUrl = 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=88123';
    const parsedUrl = parseAssociationUrl(rawUrl)!;
    const officialData = await fetchOfficialTeamData(parsedUrl, mockFetch as unknown as typeof fetch);

    expect(officialData.association).toBe('torneopal');
    expect(officialData.sport).toBe('volleyball');
    expect(officialData.fixtures[0]?.setScores).toBeDefined();

    const icsContent = loadIcsFixture('torneopal_puma_volleyball.ics');
    const events = await parseICSFeed(icsContent, 'prof-puma', 'volleyball');
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('should gracefully handle offline import failure when federation URL is unreachable', async () => {
    const brokenFetch = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const parsedUrl = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/99999')!;
    await expect(
      fetchOfficialTeamData(parsedUrl, brokenFetch as unknown as typeof fetch)
    ).rejects.toThrow(/HTTP 404/);
  });
});
