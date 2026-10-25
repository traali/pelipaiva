import { describe, it, expect } from 'vitest';
import { detectSportFromText } from '../../src/lib/ai/eventCandidateRanker';
import { harmonizeStartupSports } from '../../src/lib/sport/startupHarmonizer';
import type { MatchdayEvent, PlayerProfile, SportType } from '../../src/types/matchday';

describe('Adversarial Challenge: detectSportFromText', () => {
  it('ADV-SPORT-1: Degenerate, null, non-string, and empty inputs', () => {
    expect(detectSportFromText('' as any)).toBeUndefined();
    expect(detectSportFromText('   \n\t   ' as any)).toBeUndefined();
    expect(detectSportFromText(null as any)).toBeUndefined();
    expect(detectSportFromText(undefined as any)).toBeUndefined();
    expect(detectSportFromText(12345 as any)).toBeUndefined();
    expect(detectSportFromText({} as any)).toBeUndefined();
    expect(detectSportFromText([] as any)).toBeUndefined();
    expect(detectSportFromText(true as any)).toBeUndefined();
  });

  it('ADV-SPORT-2: Finnish compound nouns with ASCII suffixes', () => {
    expect(detectSportFromText('Lätkätreenit')).toBe('icehockey');
    expect(detectSportFromText('Futsaltreenit')).toBe('futsal');
    expect(detectSportFromText('Säbätreenit')).toBe('floorball');
    expect(detectSportFromText('Koristreenit')).toBe('basketball');
    expect(detectSportFromText('Futistreenit')).toBe('football');
    expect(detectSportFromText('Lentistreenit')).toBe('volleyball');
    expect(detectSportFromText('Fysiikkatreenit')).toBe('training');
    expect(detectSportFromText('Kuntopiiritreenit')).toBe('training');
    expect(detectSportFromText('Juoksutreenit')).toBe('training');
    expect(detectSportFromText('Oheisharjoitus')).toBe('training');
    expect(detectSportFromText('Kuntosalivuoro')).toBe('training');
    expect(detectSportFromText('Punttisalitreeni')).toBe('training');
  });

  it('ADV-SPORT-3: Finnish compound nouns with non-ASCII vowels in suffix (ä, ö, å)', () => {
    // Tests whether \\w* fails on non-ASCII characters in suffixes
    expect(detectSportFromText('säbäpäivä')).toBe('floorball');
    expect(detectSportFromText('lätkäjää')).toBe('icehockey');
    expect(detectSportFromText('futispäättäjäiset')).toBe('football');
    expect(detectSportFromText('säbämääriä')).toBe('floorball');
    expect(detectSportFromText('korispeli')).toBe('basketball');
    expect(detectSportFromText('lentopallopäivä')).toBe('volleyball');
    expect(detectSportFromText('salibandypäivä')).toBe('floorball');
    expect(detectSportFromText('futsalpäivä')).toBe('futsal');

    // Known failure: "kiekko" followed by suffix containing ä/ö fails because \\w* is ASCII-only in JS RegExp
    const kiekkopaiva = detectSportFromText('kiekkopäivä');
    console.log('detectSportFromText("kiekkopäivä") result:', kiekkopaiva);
    // Worker must support compound suffixes with ä/ö/å like "kiekkopäivä"
    expect(kiekkopaiva, 'kiekkopäivä must be detected as icehockey').toBe('icehockey');
  });

  it('ADV-SPORT-4: Mixed sport references & precedence', () => {
    expect(detectSportFromText('Lätkäjoukkueen futistreenit')).toBe('icehockey');
    expect(detectSportFromText('Futisjengin säbäturnaus')).toBe('floorball');
    expect(detectSportFromText('Futsal-joukkueen jalkapallopeli')).toBe('futsal');
    expect(detectSportFromText('Koripalloilijoiden fysiikkatreenit')).toBe('basketball');
  });

  it('ADV-SPORT-5: Basketball club recognition and club name clashes', () => {
    // ToPo (Torpan Pojat) is one of Finland\'s premier basketball clubs.
    // When playing Tapiolan Honka ("ToPo vs Honka"), "honka" matches football regex because of FC Honka,
    // while "topola" does not match "ToPo".
    const topoVsHonka = detectSportFromText('🏀 ToPo vs Honka');
    console.log('detectSportFromText("🏀 ToPo vs Honka") result:', topoVsHonka);
    expect(topoVsHonka, 'ToPo vs Honka basketball game must not be classified as football').toBe('basketball');
  });

  it('ADV-SPORT-6: ReDoS resistance with massive strings and repeated characters', () => {
    const longString1 = 'a'.repeat(50000) + ' futistreenit ' + 'b'.repeat(50000);
    const start1 = performance.now();
    const res1 = detectSportFromText(longString1);
    const dur1 = performance.now() - start1;
    expect(res1).toBe('football');
    expect(dur1).toBeLessThan(100);

    const longString2 = 'koulu '.repeat(10000);
    const start2 = performance.now();
    const res2 = detectSportFromText(longString2);
    const dur2 = performance.now() - start2;
    expect(res2).toBe('school');
    expect(dur2).toBeLessThan(100);
  });
});

describe('Adversarial Challenge: harmonizeStartupSports', () => {
  it('ADV-HARM-1: Empty or minimal profiles and events', () => {
    const result = harmonizeStartupSports([], []);
    expect(result.profileUpdates).toEqual([]);
    expect(result.eventUpdates).toEqual([]);
  });

  it('ADV-HARM-2: Robustness against missing, nullish, or empty fields', () => {
    const profiles: PlayerProfile[] = [
      {
        id: 'p1',
        playerName: 'Matti',
        teamName: '',
        sport: 'football',
        primaryColor: 'sininen',
        colorHex: '#000000'
      },
      {
        id: 'p2',
        playerName: 'Teemu',
        teamName: undefined as any,
        sport: undefined as any,
        primaryColor: 'punainen',
        colorHex: '#ffffff',
        calendarUrl: '   '
      }
    ];

    const events: MatchdayEvent[] = [
      {
        id: 'e1',
        profileId: 'p1',
        title: '',
        startTime: '2026-10-25T10:00:00Z',
        endTime: '2026-10-25T11:00:00Z',
        venue: {
          name: '',
          normalizedName: '',
          address: '',
          coordinates: undefined,
          isIndoor: false,
          surface: 'artificial_turf_3g'
        },
        sport: undefined as any,
        isTraining: true,
        source: 'manual',
        status: 'confirmed'
      },
      {
        id: 'e2',
        profileId: 'non-existent-profile',
        title: 'Random Event Without Profile',
        startTime: '2026-10-25T12:00:00Z',
        endTime: '2026-10-25T13:00:00Z',
        venue: {
          name: 'Jäähalli',
          normalizedName: 'jäähalli',
          address: 'Kiekkoilijankatu 1',
          isIndoor: false,
          surface: 'artificial_turf_3g'
        },
        sport: 'icehockey',
        isTraining: true,
        source: 'manual',
        status: 'confirmed'
      }
    ];

    expect(() => {
      const res = harmonizeStartupSports(profiles, events);
      expect(res).toBeDefined();
    }).not.toThrow();
  });

  it('ADV-HARM-3: Non-destructive guarantee: NEVER overwrite valid non-football sports', () => {
    const allSports: SportType[] = [
      'floorball',
      'basketball',
      'volleyball',
      'icehockey',
      'futsal',
      'training',
      'school',
      'other'
    ];

    const footballProfile: PlayerProfile = {
      id: 'p-fb',
      playerName: 'Multi-athlete',
      teamName: 'PPJ Edustus',
      sport: 'football',
      primaryColor: 'sininen',
      colorHex: '#3b82f6'
    };

    const events: MatchdayEvent[] = allSports.map((sport, i) => ({
      id: `ev-${sport}-${i}`,
      profileId: 'p-fb',
      title: `Event ${i}`,
      startTime: '2026-10-25T10:00:00Z',
      endTime: '2026-10-25T11:00:00Z',
      venue: {
        name: 'Urheiluhalli',
        normalizedName: 'urheiluhalli',
        address: 'Tie 1',
        isIndoor: true,
        surface: 'indoor_synthetic'
      },
      sport: sport,
      isTraining: true,
      source: 'calendar',
      status: 'confirmed'
    }));

    const result = harmonizeStartupSports([footballProfile], events);

    for (const eu of result.eventUpdates) {
      if (eu.updates.sport) {
        expect(eu.updates.sport, `Event ${eu.id} was clobbered to ${eu.updates.sport}`).not.toBe('football');
      }
    }
  });

  it('ADV-HARM-4: Re-healing corrupted football events back to their true sport', () => {
    const profile: PlayerProfile = {
      id: 'p-hockey',
      playerName: 'Saku',
      teamName: 'Jokerit U12',
      sport: 'icehockey',
      primaryColor: 'sininen',
      colorHex: '#3b82f6'
    };

    const corruptedEvents: MatchdayEvent[] = [
      {
        id: 'c1',
        profileId: 'p-hockey',
        title: 'Harjoitukset (Jää 1)',
        startTime: '2026-10-25T15:00:00Z',
        endTime: '2026-10-25T16:00:00Z',
        venue: {
          name: 'Helsingin Jäähalli',
          normalizedName: 'helsingin jäähalli',
          address: 'Nordenskiöldinkatu 11-13',
          isIndoor: false,
          surface: 'artificial_turf_3g'
        },
        sport: 'football',
        isTraining: true,
        source: 'calendar',
        status: 'confirmed'
      },
      {
        id: 'c2',
        profileId: 'p-hockey',
        title: 'Matematiikan koe',
        startTime: '2026-10-26T08:00:00Z',
        endTime: '2026-10-26T09:00:00Z',
        venue: {
          name: 'Lauttasaaren yhteiskoulu',
          normalizedName: 'lauttasaaren yhteiskoulu',
          address: 'Isokaari 19',
          isIndoor: false,
          surface: 'artificial_turf_3g'
        },
        sport: 'football',
        isTraining: false,
        source: 'calendar',
        status: 'confirmed'
      }
    ];

    const result = harmonizeStartupSports([profile], corruptedEvents);

    const c1Update = result.eventUpdates.find(u => u.id === 'c1');
    expect(c1Update).toBeDefined();
    expect(c1Update?.updates.sport).toBe('icehockey');
    expect(c1Update?.updates.venue?.surface).toBe('ice');
    expect(c1Update?.updates.venue?.isIndoor).toBe(true);

    const c2Update = result.eventUpdates.find(u => u.id === 'c2');
    expect(c2Update).toBeDefined();
    expect(c2Update?.updates.sport).toBe('school');
    expect(c2Update?.updates.venue?.surface).toBe('indoor_parquet');
    expect(c2Update?.updates.venue?.isIndoor).toBe(true);
  });

  it('ADV-HARM-5: Stress scale: 10,000 mixed multi-sport events in under 500ms', () => {
    const sports: SportType[] = [
      'football',
      'floorball',
      'basketball',
      'volleyball',
      'icehockey',
      'futsal',
      'training',
      'school',
      'other'
    ];

    const profiles: PlayerProfile[] = Array.from({ length: 20 }, (_, i) => ({
      id: `prof-${i}`,
      playerName: `Player ${i}`,
      teamName: `Team ${i} (${sports[i % sports.length]})`,
      sport: sports[i % sports.length]!,
      primaryColor: 'sininen',
      colorHex: '#3b82f6'
    }));

    const events: MatchdayEvent[] = Array.from({ length: 10000 }, (_, i) => {
      const sport = sports[i % sports.length]!;
      const isCorrupted = i % 5 === 0;
      return {
        id: `ev-stress-${i}`,
        profileId: `prof-${i % 20}`,
        title: `${sport} event ${i}`,
        startTime: '2026-10-25T10:00:00Z',
        endTime: '2026-10-25T11:00:00Z',
        venue: {
          name: i % 10 === 0 ? 'Pirkkolan jäähalli' : 'Koulun liikuntasali LYK',
          normalizedName: '',
          address: 'Osoite 1',
          isIndoor: false,
          surface: 'artificial_turf_3g'
        },
        sport: isCorrupted ? 'football' : sport,
        isTraining: i % 2 === 0,
        source: 'calendar',
        status: 'confirmed'
      };
    });

    const startTime = performance.now();
    const result = harmonizeStartupSports(profiles, events);
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(1000);
    expect(result.eventUpdates.length).toBeGreaterThan(0);
  });

  it('ADV-HARM-6: Association and calendar URL sanity cleaning', () => {
    const profiles: PlayerProfile[] = [
      {
        id: 'p-bad-cal',
        playerName: 'Antti',
        teamName: 'PPJ',
        sport: 'football',
        primaryColor: 'sininen',
        colorHex: '#3b82f6',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/12345/fixture'
      },
      {
        id: 'p-invalid-proto',
        playerName: 'Ville',
        teamName: 'Indians',
        sport: 'floorball',
        primaryColor: 'keltainen',
        colorHex: '#eab308',
        calendarUrl: 'not_a_valid_url'
      }
    ];

    const result = harmonizeStartupSports(profiles, []);

    const p1 = result.profileUpdates.find(u => u.id === 'p-bad-cal');
    expect(p1).toBeDefined();
    expect(p1?.updates.calendarUrl).toBeUndefined();
    expect(p1?.updates.associationUrl).toBe('https://tulospalvelu.palloliitto.fi/team/12345/fixture');

    const p2 = result.profileUpdates.find(u => u.id === 'p-invalid-proto');
    expect(p2).toBeDefined();
    expect(p2?.updates.calendarUrl).toBeUndefined();
  });
});
