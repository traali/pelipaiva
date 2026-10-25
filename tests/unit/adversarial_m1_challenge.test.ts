import { describe, it, expect } from 'vitest';
import { mergeRosters, FamilyRosterV1, rosterFingerprint } from '../../src/lib/sync/familyCloud';
import { generateStableProfileId } from '../../src/lib/clubs/attachTeam';
import {
  classifyCalendarEvent,
  isTrainingEvent,
  parseICSFeed,
  extractFeedCategories
} from '../../src/lib/calendar/icsParser';
import { detectSportFromText } from '../../src/lib/ai/eventCandidateRanker';
import { PlayerProfile, SportType } from '../../src/types/matchday';

describe('Milestone 1 Adversarial Challenge: Family Cloud & Multi-Sport Sync', () => {
  it('ADV-1.1: Sibling profiles sharing the same first name with different sports and empty/custom URLs', () => {
    // Sibling 1: "Leo", football player with legacy or auto ID
    // Sibling 2: "Leo", floorball player with legacy or auto ID
    const localProfiles: PlayerProfile[] = [
      {
        id: 'legacy-profile-1',
        playerName: 'Leo',
        teamName: 'PPJ D-pojat',
        sport: 'football',
        primaryColor: 'sininen',
        colorHex: '#3b82f6',
        calendarUrl: ''
      },
      {
        id: 'legacy-profile-2',
        playerName: 'Leo',
        teamName: 'Indians Säbä',
        sport: 'floorball',
        primaryColor: 'keltainen',
        colorHex: '#eab308',
        calendarUrl: ''
      }
    ];

    const { mergedProfiles } = mergeRosters(localProfiles, null);
    
    console.log('ADV-1.1 Merged count:', mergedProfiles.length);
    console.log('ADV-1.1 Profiles:', mergedProfiles.map(p => ({ id: p.id, name: p.playerName, sport: p.sport })));
    expect(mergedProfiles.length).toBe(2);
    expect(mergedProfiles.filter(p => p.sport === 'football').length).toBe(1);
    expect(mergedProfiles.filter(p => p.sport === 'floorball').length).toBe(1);
  });

  it('ADV-1.2: Multi-sport child with 3+ official sports (basketball, floorball, volleyball, icehockey)', () => {
    // Child "Aada" active in Basketball, Floorball, and Ice Hockey
    const localProfiles: PlayerProfile[] = [
      {
        id: 'p:aada:basket',
        playerName: 'Aada',
        teamName: 'ToPo T12',
        sport: 'basketball',
        primaryColor: 'sininen',
        colorHex: '#3b82f6',
        associationUrl: 'https://basket.fi/team/101'
      },
      {
        id: 'p:aada:floorball',
        playerName: 'Aada',
        teamName: 'Oilers Tytöt',
        sport: 'floorball',
        primaryColor: 'sininen',
        colorHex: '#3b82f6',
        associationUrl: 'https://salibandy.fi/team/202'
      },
      {
        id: 'p:aada:hockey',
        playerName: 'Aada',
        teamName: 'Kiekko-Espoo Naiset',
        sport: 'icehockey',
        primaryColor: 'sininen',
        colorHex: '#3b82f6',
        associationUrl: 'https://kiekko.torneopal.fi/team/303'
      },
      // Non-association calendar profile for her floorball team
      {
        id: 'p:aada:floorball-nimenhuuto',
        playerName: 'Aada',
        teamName: 'Oilers Säbä Nimenhuuto',
        sport: 'football', // initially defaulted or corrupted to football
        primaryColor: 'sininen',
        colorHex: '#3b82f6',
        calendarUrl: 'https://oilers-tytot.nimenhuuto.com/events.ics'
      }
    ];

    const { mergedProfiles } = mergeRosters(localProfiles, null);
    console.log('ADV-1.2 Profiles after merge:', mergedProfiles.map(p => ({ id: p.id, sport: p.sport, team: p.teamName })));
    
    // Check if the floorball nimenhuuto profile was harmonized to floorball or stuck at football / corrupted to hockey
    const nimenhuutoProfile = mergedProfiles.find(p => p.id === 'p:aada:floorball-nimenhuuto');
    expect(nimenhuutoProfile).toBeDefined();
    // It should be floorball because its team name is Oilers Säbä!
    expect(nimenhuutoProfile?.sport).toBe('floorball');
  });

  it('ADV-1.3: Profiles with corrupted, malformed, or hostile URLs', () => {
    const maliciousUrls = [
      'javascript:alert(1)',
      '   https://valid.com/team/123   ',
      'not-a-url-at-all with spaces and / / ? & %',
      'https://invalid.domain.xyz/%E0%A4%A',
      'http://[::1]:999999/invalid/port',
      'https://test.com/path?pipe=|test|&amp;foo=bar'
    ];

    const localProfiles: PlayerProfile[] = maliciousUrls.map((url, i) => ({
      id: `local-${i}`,
      playerName: `Player ${i}`,
      teamName: `Team ${i}`,
      sport: 'football',
      primaryColor: 'sininen',
      colorHex: '#3b82f6',
      calendarUrl: url
    }));

    expect(() => {
      const { mergedProfiles } = mergeRosters(localProfiles, null);
      expect(mergedProfiles.length).toBe(maliciousUrls.length);
    }).not.toThrow();
  });
});

describe('Milestone 1 Adversarial Challenge: ICS Parser & School Event Classification', () => {
  it('ADV-2.1: Tricky school exam and class titles: Fysiikan kertauskoe, Kertauskoe, etc.', () => {
    const schoolTitles = [
      'Fysiikan kertauskoe',
      'Kertauskoe: Matematiikka',
      'Matikan koe',
      'Fysiikkakoe',
      'Biologian koe',
      'Kemian laboratoriotyö',
      'Ruotsin sanakoe',
      'Englannin kuuntelukoe',
      'Äidinkielen yo-koe',
      'Koulukuvaus',
      'Vanhempainvartti',
      'Wilma-viesti: Uusintakoe',
      'Wilma: Todistusten jako'
    ];

    const results: Array<{ title: string; classification: string; isTraining: boolean; sport?: string }> = [];

    for (const title of schoolTitles) {
      const classification = classifyCalendarEvent(title);
      const isTraining = isTrainingEvent(title);
      const detectedSport = detectSportFromText(title);
      results.push({ title, classification, isTraining, sport: detectedSport });
      console.log(`Title: "${title}" -> classified: ${classification}, isTraining: ${isTraining}, sport: ${detectedSport}`);
    }

    const failed = results.filter(r => r.isTraining || (r.classification !== 'school' && r.classification !== 'meeting'));
    expect(failed.length, `Failed titles: ${JSON.stringify(failed, null, 2)}`).toBe(0);
  });

  it('ADV-2.2: School sporting events vs Club sports events: Koulun salibandyturnaus', () => {
    const ambiguousTitles = [
      'Koulun salibandyturnaus',
      'Koulujenvälinen jalkapalloturnaus',
      'Koulun yleisurheilupäivä',
      'Luistelupäivä koululla',
      'Salibandyturnaus (Koululiikuntaliitto)'
    ];

    for (const title of ambiguousTitles) {
      const classification = classifyCalendarEvent(title);
      const detectedSport = detectSportFromText(title);
      console.log(`Ambiguous title: "${title}" -> classified: ${classification}, sport: ${detectedSport}`);
    }
  });

  it('ADV-2.3: Massive school calendar ICS import (1,000 events)', async () => {
    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wilma//School Calendar//FI',
      'X-WR-CALNAME:Koulukalenteri 2026'
    ];

    const startDate = new Date('2026-08-15T08:00:00Z');
    for (let i = 0; i < 1000; i++) {
      const curStart = new Date(startDate.getTime() + i * 3600 * 1000);
      const curEnd = new Date(curStart.getTime() + 45 * 60 * 1000);
      const startStr = curStart.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const endStr = curEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      const subject = i % 4 === 0 ? 'Matematiikan oppitunti' : (i % 4 === 1 ? 'Fysiikan koe' : (i % 4 === 2 ? 'Koulupäivä' : 'Ruotsin tunti'));

      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:wilma-event-${i}@wilma.fi`);
      icsLines.push(`DTSTAMP:20260801T000000Z`);
      icsLines.push(`DTSTART:${startStr}`);
      icsLines.push(`DTEND:${endStr}`);
      icsLines.push(`SUMMARY:${subject} (Luokka ${7 + (i % 3)}B)`);
      icsLines.push(`LOCATION:Koulukatu 1, Helsinki`);
      icsLines.push(`DESCRIPTION:Wilma-merkintä: muista kirjat.`);
      icsLines.push('END:VEVENT');
    }
    icsLines.push('END:VCALENDAR');

    const massiveIcs = icsLines.join('\r\n');

    const startParse = performance.now();
    const events = await parseICSFeed(massiveIcs, 'profile-school', 'school');
    const parseTimeMs = performance.now() - startParse;

    console.log(`Parsed 1000 school events in ${parseTimeMs.toFixed(1)}ms. Total events returned: ${events.length}`);
    expect(events.length).toBe(1000);
    expect(parseTimeMs).toBeLessThan(5000);

    // Verify sport and eventType integrity
    const nonSchoolEvents = events.filter(e => e.eventType !== 'school' || e.sport !== 'school');
    console.log(`Non-school events found: ${nonSchoolEvents.length}`);
    expect(nonSchoolEvents.length).toBe(0);
  });
});
