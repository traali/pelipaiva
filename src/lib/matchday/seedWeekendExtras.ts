import type { MatchdayEvent, PlayerProfile, SportType, VenueInfo } from '../../types/matchday';
import { generateMatchdayBriefing } from '../ai/deterministicReasoner';

const MOSA: VenueInfo = {
  name: 'Tapanilan Mosahalli',
  normalizedName: 'mosahalli',
  city: 'Helsinki',
  coordinates: { lat: 60.2612, lng: 25.0234 },
  isIndoor: true,
  surface: 'indoor_synthetic',
  hasFloodlights: true
};

const LAUTTASAARI: VenueInfo = {
  name: 'Lauttasaari TN B',
  normalizedName: 'lauttasaari tn b',
  city: 'Helsinki',
  coordinates: { lat: 60.16357, lng: 24.8675 },
  isIndoor: false,
  surface: 'artificial_turf_3g',
  hasFloodlights: true
};

const KAPYLA: VenueInfo = {
  name: 'Käpylän Urheilupuisto TN 1',
  normalizedName: 'kapylan urheilupuisto tn 1',
  city: 'Helsinki',
  coordinates: { lat: 60.2135, lng: 24.9452 },
  isIndoor: false,
  surface: 'artificial_turf_3g',
  hasFloodlights: true
};

const ESPORT: VenueInfo = {
  name: 'Esport Center 2',
  normalizedName: 'esport center 2',
  city: 'Espoo',
  coordinates: { lat: 60.1756, lng: 24.8054 },
  isIndoor: true,
  surface: 'indoor_parquet',
  hasFloodlights: true
};

function atWeekend(dow: number, hour: number, minute = 0): Date {
  const now = new Date();
  const hel = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }));
  const today = hel.getDay();
  let add = dow - today;
  if (dow === 0 && today !== 0) add = 7 - today;
  const d = new Date(hel);
  d.setDate(d.getDate() + add);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function iso(d: Date): string {
  return d.toISOString();
}

function ev(opts: {
  id: string;
  profileId: string;
  sport: SportType;
  title: string;
  home: string;
  away: string;
  start: Date;
  venue: VenueInfo;
  isTraining?: boolean;
  volunteerDuty?: string;
  tournamentName?: string;
  eventType?: MatchdayEvent['eventType'];
}): MatchdayEvent {
  const mins = opts.eventType === 'tournament' ? 50 : 90;
  const end = new Date(opts.start.getTime() + mins * 60000);
  const warmup = new Date(opts.start.getTime() - (opts.isTraining ? 15 : 45) * 60000);
  const event: MatchdayEvent = {
    id: opts.id,
    profileId: opts.profileId,
    sport: opts.sport,
    eventType: opts.eventType || (opts.isTraining ? 'training' : 'match'),
    isTraining: Boolean(opts.isTraining),
    title: opts.title,
    homeTeam: opts.home,
    awayTeam: opts.away,
    isHomeMatch: true,
    startTime: iso(opts.start),
    endTime: iso(end),
    warmupTime: iso(warmup),
    tournamentName: opts.tournamentName,
    venue: opts.venue,
    volunteerDuty: opts.volunteerDuty,
    weather: opts.venue.isIndoor
      ? {
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 0,
          windGustMs: 0,
          rainProbabilityPercent: 0,
          precipitationMmh: 0,
          rainTimeline: [],
          turfCondition: 'dry'
        }
      : undefined
  };
  event.briefing = generateMatchdayBriefing(event, [event]);
  return event;
}

export const EXTRA_PROFILES: PlayerProfile[] = [
  {
    id: 'profile-topola-aada',
    playerName: 'Aada',
    teamName: 'TOPOLA · Girls 2015 Fun',
    sport: 'basketball',
    primaryColor: 'syaani',
    calendarUrl: 'https://espooliikkuutournament.fi/team/203621',
    associationUrl: 'https://espooliikkuutournament.fi/team/203621',
    associationType: 'basket',
    teamId: '203621',
    colorHex: '#21C3F7'
  },
  {
    id: 'profile-kw-eemil',
    playerName: 'Eemil',
    teamName: 'EräViikingit · KW Memorial',
    sport: 'floorball',
    primaryColor: 'tummansininen',
    secondaryColor: 'punainen',
    calendarUrl:
      'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546',
    associationUrl:
      'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546',
    associationType: 'torneopal',
    teamId: '34013',
    colorHex: '#1d4ed8'
  }
];

export function buildWeekendShowcaseEvents(): MatchdayEvent[] {
  const sat10 = atWeekend(6, 10, 0);
  const sat13 = atWeekend(6, 13, 0);
  const sun10 = atWeekend(0, 10, 0);
  const eltSat945 = new Date('2026-08-22T09:45:00+03:00');
  const eltSat15 = new Date('2026-08-22T15:00:00+03:00');
  const eltSun1030 = new Date('2026-08-23T10:30:00+03:00');
  const kwSun9 = atWeekend(0, 9, 0);
  const kwSun1115 = atWeekend(0, 11, 15);
  const kwSun1430 = atWeekend(0, 14, 30);

  return [
    ev({
      id: 'demo-hc-simo-1',
      profileId: 'profile-ppj-185085',
      sport: 'football',
      title: 'PPJ/Laru sin vs HJK',
      home: 'PPJ/Laru sin',
      away: 'HJK',
      start: sat10,
      venue: KAPYLA,
      eventType: 'tournament',
      tournamentName: 'Helsinki Cup 2026'
    }),
    ev({
      id: 'demo-hc-simo-2',
      profileId: 'profile-ppj-185085',
      sport: 'football',
      title: 'PPJ/Laru sin vs KäPa',
      home: 'PPJ/Laru sin',
      away: 'KäPa',
      start: sat13,
      venue: KAPYLA,
      eventType: 'tournament',
      tournamentName: 'Helsinki Cup 2026'
    }),
    ev({
      id: 'demo-football-simo-sun',
      profileId: 'profile-ppj-185085',
      sport: 'football',
      title: 'PPJ/Laru sin vs Honka',
      home: 'PPJ/Laru sin',
      away: 'Honka',
      start: sun10,
      venue: LAUTTASAARI
    }),
    ev({
      id: 'demo-elt-aada-1',
      profileId: 'profile-topola-aada',
      sport: 'basketball',
      title: 'EBT vs TOPOLA',
      home: 'EBT',
      away: 'TOPOLA',
      start: eltSat945,
      venue: ESPORT,
      eventType: 'tournament',
      tournamentName: 'Espoo Liikkuu Tournament 2026'
    }),
    ev({
      id: 'demo-elt-aada-2',
      profileId: 'profile-topola-aada',
      sport: 'basketball',
      title: 'TOPOLA vs Jymy',
      home: 'TOPOLA',
      away: 'Jymy',
      start: eltSat15,
      venue: ESPORT,
      eventType: 'tournament',
      tournamentName: 'Espoo Liikkuu Tournament 2026'
    }),
    ev({
      id: 'demo-elt-aada-3',
      profileId: 'profile-topola-aada',
      sport: 'basketball',
      title: 'TOPOLA vs Helmi Basket/Valkoinen',
      home: 'TOPOLA',
      away: 'Helmi Basket/Valkoinen',
      start: eltSun1030,
      venue: ESPORT,
      eventType: 'tournament',
      tournamentName: 'Espoo Liikkuu Tournament 2026'
    }),
    ev({
      id: 'demo-kw-eemil-1',
      profileId: 'profile-kw-eemil',
      sport: 'floorball',
      title: 'EräViikingit vs Oilers',
      home: 'EräViikingit',
      away: 'Oilers',
      start: kwSun9,
      venue: MOSA,
      eventType: 'tournament',
      tournamentName: 'KW Memorial Cup 2026'
    }),
    ev({
      id: 'demo-kw-eemil-2',
      profileId: 'profile-kw-eemil',
      sport: 'floorball',
      title: 'EräViikingit vs Classic',
      home: 'EräViikingit',
      away: 'Classic',
      start: kwSun1115,
      venue: MOSA,
      eventType: 'tournament',
      tournamentName: 'KW Memorial Cup 2026'
    }),
    ev({
      id: 'demo-kw-eemil-3',
      profileId: 'profile-kw-eemil',
      sport: 'floorball',
      title: 'EräViikingit vs Indians',
      home: 'EräViikingit',
      away: 'Indians',
      start: kwSun1430,
      venue: MOSA,
      eventType: 'tournament',
      tournamentName: 'KW Memorial Cup 2026',
      volunteerDuty: 'Kahviovuoro (klo 14:00 - 16:00)'
    })
  ];
}


