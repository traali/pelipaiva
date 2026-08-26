import { SportType } from '../../types/matchday';

export interface ClubPreset {
  id: string;
  name: string;
  shortName: string;
  city: string;
  sport: SportType;
  primaryColor: string;
  colorHex: string;
  sampleTeamUrl: string;
  popularAgeGroups: string[];
}

export const POPULAR_FINNISH_CLUBS: ClubPreset[] = [
  // ⚽ Football
  {
    id: 'football-default-185085',
    name: 'Jalkapallojoukkue (Palloliitto 185085)',
    shortName: 'Jalkapallo 1',
    city: 'Helsinki / Uusimaa',
    sport: 'football',
    primaryColor: 'sininen',
    colorHex: '#003580',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
    popularAgeGroups: ['T13 Sininen', 'P12 Sininen', 'Kilpa', 'Edustus']
  },
  {
    id: 'football-default-185083',
    name: 'Jalkapallojoukkue (Palloliitto 185083)',
    shortName: 'Jalkapallo 2',
    city: 'Helsinki / Uusimaa',
    sport: 'football',
    primaryColor: 'valkoinen',
    colorHex: '#059669',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
    popularAgeGroups: ['T13 Valkoinen', 'P12 Valkoinen', 'Haaste']
  },
  {
    id: 'football-default-185086',
    name: 'Jalkapallojoukkue (Palloliitto 185086)',
    shortName: 'Jalkapallo 3',
    city: 'Helsinki / Uusimaa',
    sport: 'football',
    primaryColor: 'musta',
    colorHex: '#18181b',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
    popularAgeGroups: ['P11 Musta', 'T12 Musta', 'Akatemia']
  },
  {
    id: 'hjk',
    name: 'Helsingin Jalkapalloklubi (HJK)',
    shortName: 'HJK',
    city: 'Helsinki',
    sport: 'football',
    primaryColor: 'sininen',
    colorHex: '#003580',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/',
    popularAgeGroups: ['T13 Sininen', 'T13 Valkoinen', 'P12 Sininen', 'P11 Akatemia', 'Edustus']
  },
  {
    id: 'honka',
    name: 'FC Honka',
    shortName: 'Honka',
    city: 'Espoo',
    sport: 'football',
    primaryColor: 'keltainen',
    colorHex: '#facc15',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/60450',
    popularAgeGroups: ['T12 Keltainen', 'P13 Musta', 'P11 Akatemia', 'T14 Haaste']
  },
  {
    id: 'kapa',
    name: 'Käpylän Pallo (KäPa)',
    shortName: 'KäPa',
    city: 'Helsinki',
    sport: 'football',
    primaryColor: 'musta',
    colorHex: '#18181b',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/60500',
    popularAgeGroups: ['P13 United', 'P12 City', 'P11 Edustus', 'T12 AC']
  },
  {
    id: 'vjs',
    name: 'Vantaan Jalkapalloseura (VJS)',
    shortName: 'VJS',
    city: 'Vantaa',
    sport: 'football',
    primaryColor: 'punainen',
    colorHex: '#dc2626',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/60600',
    popularAgeGroups: ['T13 Punainen', 'P12 Valkoinen', 'P14 Punainen', 'P11 Haaste']
  },
  {
    id: 'tips',
    name: 'Tikkurilan Palloseura (TiPS)',
    shortName: 'TiPS',
    city: 'Vantaa',
    sport: 'football',
    primaryColor: 'vihreä',
    colorHex: '#16a34a',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/60700',
    popularAgeGroups: ['T13 Vihreä', 'P12 Musta', 'P11 Vihreä']
  },
  {
    id: 'eps',
    name: 'Espoon Palloseura (EPS)',
    shortName: 'EPS',
    city: 'Espoo',
    sport: 'football',
    primaryColor: 'punainen',
    colorHex: '#ef4444',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/60800',
    popularAgeGroups: ['T13 Punainen', 'P12 Musta', 'P11 Akatemia', 'T11 Valkoinen']
  },
  {
    id: 'ppj',
    name: 'Pallo-Pojat Juniorit (PPJ)',
    shortName: 'PPJ',
    city: 'Helsinki',
    sport: 'football',
    primaryColor: 'oranssi',
    colorHex: '#f97316',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/60900',
    popularAgeGroups: ['P13 Kilpa', 'T12 Oranssi', 'P11 Eira', 'P12 Lauttasaari']
  },
  {
    id: 'ilves-jalkapallo',
    name: 'Tampereen Ilves (Jalkapallo)',
    shortName: 'Ilves',
    city: 'Tampere',
    sport: 'football',
    primaryColor: 'keltainen',
    colorHex: '#eab308',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/61000',
    popularAgeGroups: ['P13 Keltainen', 'T12 Vihreä', 'P11 Edustus']
  },
  {
    id: 'tps-jalkapallo',
    name: 'Turun Palloseura (TPS Jalkapallo)',
    shortName: 'TPS',
    city: 'Turku',
    sport: 'football',
    primaryColor: 'mustavalkoinen',
    colorHex: '#27272a',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/61100',
    popularAgeGroups: ['P13 Raita', 'T12 Musta', 'P11 Edustus']
  },
  {
    id: 'gnistan',
    name: 'IF Gnistan',
    shortName: 'Gnistan',
    city: 'Helsinki',
    sport: 'football',
    primaryColor: 'keltainen',
    colorHex: '#eab308',
    sampleTeamUrl: 'https://tulospalvelu.palloliitto.fi/team/61200',
    popularAgeGroups: ['P12 Keltaiset', 'T13 Sinikeltaiset', 'P11 Kilpa']
  },

  // 🏑 Floorball
  {
    id: 'floorball-default',
    name: 'Salibandyjoukkue (Salibandyliitto)',
    shortName: 'Salibandy',
    city: 'Helsinki / Espoo / Vantaa',
    sport: 'floorball',
    primaryColor: 'sininen',
    colorHex: '#2563eb',
    sampleTeamUrl: 'https://tulospalvelu.salibandy.fi/team/25301/info',
    popularAgeGroups: ['P13 Pohjoinen', 'T12 Edustus', 'KW Memorial']
  },
  {
    id: 'ervi',
    name: 'EräViikingit (ErVi)',
    shortName: 'ErVi',
    city: 'Helsinki/Vantaa',
    sport: 'floorball',
    primaryColor: 'sininen',
    colorHex: '#1d4ed8',
    sampleTeamUrl: 'https://tulospalvelu.salibandy.fi/team/25301/info',
    popularAgeGroups: ['P13 Pohjoinen', 'T12 Edustus', 'KW Memorial']
  },
  {
    id: 'classic',
    name: 'SC Classic',
    shortName: 'Classic',
    city: 'Tampere',
    sport: 'floorball',
    primaryColor: 'punainen',
    colorHex: '#dc2626',
    sampleTeamUrl: 'https://tulospalvelu.salibandy.fi/team/10200',
    popularAgeGroups: ['P13 Red', 'T12 White', 'P11 Sininen', 'P12 Edustus']
  },
  {
    id: 'oilers',
    name: 'Esport Oilers',
    shortName: 'Oilers',
    city: 'Espoo',
    sport: 'floorball',
    primaryColor: 'musta',
    colorHex: '#09090b',
    sampleTeamUrl: 'https://tulospalvelu.salibandy.fi/team/10300',
    popularAgeGroups: ['P13 Black', 'P12 White', 'P11 NG', 'T12 Akatemia']
  },
  {
    id: 'indians',
    name: 'Westend Indians',
    shortName: 'Indians',
    city: 'Espoo',
    sport: 'floorball',
    primaryColor: 'keltainen',
    colorHex: '#ca8a04',
    sampleTeamUrl:
      'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546',
    popularAgeGroups: ['P13 Heimo', 'P12 Keltaiset', 'T12 Mustat']
  },
  {
    id: 'spv',
    name: 'Seinäjoen Peliveljet (SPV)',
    shortName: 'SPV',
    city: 'Seinäjoki',
    sport: 'floorball',
    primaryColor: 'punainen',
    colorHex: '#b91c1c',
    sampleTeamUrl: 'https://tulospalvelu.salibandy.fi/team/10500',
    popularAgeGroups: ['P13 Punaiset', 'P12 Valkoiset']
  },

  // 🏀 Basketball
  {
    id: 'basket-default',
    name: 'Koripallojoukkue (Basket.fi)',
    shortName: 'Koripallo',
    city: 'Helsinki / Espoo',
    sport: 'basketball',
    primaryColor: 'oranssi',
    colorHex: '#f59e0b',
    sampleTeamUrl: 'https://tulospalvelu.basket.fi/team/5756346/info',
    popularAgeGroups: ['U14 Pojat', 'U13 Tytöt', 'U12 Pojat', 'Edustus']
  },
  {
    id: 'topola',
    name: 'Touhun Pojat Lauttasaari (TOPOLA)',
    shortName: 'TOPOLA',
    city: 'Helsinki',
    sport: 'basketball',
    primaryColor: 'syaani',
    colorHex: '#21C3F7',
    sampleTeamUrl: 'https://espooliikkuutournament.fi/team/203621',
    popularAgeGroups: ['Girls 2015 Fun', 'U12', 'U13']
  },
  {
    id: 'hnmky',
    name: 'Helsingin NMKY (Namika)',
    shortName: 'HNMKY',
    city: 'Helsinki',
    sport: 'basketball',
    primaryColor: 'sininen',
    colorHex: '#1d4ed8',
    sampleTeamUrl: 'https://tulospalvelu.basket.fi/team/5756346/info',
    popularAgeGroups: ['U14 Pojat Stadi', 'U13 Tytöt Pakila', 'U12 Pojat Malmi']
  },
  {
    id: 'topo',
    name: 'Torpan Pojat (ToPo)',
    shortName: 'ToPo',
    city: 'Helsinki',
    sport: 'basketball',
    primaryColor: 'sininen',
    colorHex: '#1e40af',
    sampleTeamUrl: 'https://tulospalvelu.basket.fi/team/5756346/info',
    popularAgeGroups: ['U14 Pojat', 'U13 Tytöt Sininen', 'U12 Pojat Valkoinen']
  },
  {
    id: 'puhu',
    name: 'PuHu Juniorit',
    shortName: 'PuHu',
    city: 'Vantaa',
    sport: 'basketball',
    primaryColor: 'punainen',
    colorHex: '#e11d48',
    sampleTeamUrl: 'https://www.basket.fi/basket/sarjat/joukkue/?team_id=20300',
    popularAgeGroups: ['U14 Pojat Punainen', 'U13 Tytöt Musta', 'U12 Pojat']
  },
  {
    id: 'ktp-basket',
    name: 'KTP Basket Juniorit',
    shortName: 'KTP',
    city: 'Kotka',
    sport: 'basketball',
    primaryColor: 'vihreä',
    colorHex: '#15803d',
    sampleTeamUrl: 'https://www.basket.fi/basket/sarjat/joukkue/?team_id=20400',
    popularAgeGroups: ['U14 Pojat', 'U12 Pojat Vihreä']
  },

  // 🏐 Volleyball
  {
    id: 'volleyball-default',
    name: 'Lentopallojoukkue (Lentopalloliitto)',
    shortName: 'Lentopallo',
    city: 'Koko Suomi',
    sport: 'volleyball',
    primaryColor: 'violetti',
    colorHex: '#8b5cf6',
    sampleTeamUrl: 'https://tulospalvelu.lentopallo.fi/team/57672/info',
    popularAgeGroups: ['C-tytöt', 'C-pojat', 'D-tytöt', 'B-tytöt']
  },
  {
    id: 'puma-volley',
    name: 'PuMa-Volley',
    shortName: 'PuMa',
    city: 'Helsinki',
    sport: 'volleyball',
    primaryColor: 'oranssi',
    colorHex: '#ea580c',
    sampleTeamUrl: 'https://tulospalvelu.lentopallo.fi/team/57672/info',
    popularAgeGroups: ['C-tytöt Tsemppi', 'C-pojat', 'D-tytöt Tiikerit', 'B-tytöt']
  },
  {
    id: 'valepa',
    name: 'VaLePa Juniorit',
    shortName: 'VaLePa',
    city: 'Sastamala',
    sport: 'volleyball',
    primaryColor: 'punamusta',
    colorHex: '#991b1b',
    sampleTeamUrl: 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=30200',
    popularAgeGroups: ['C-pojat', 'D-pojat Pukkipojat']
  }
];

/**
 * Searches the popular clubs catalog by keyword or city.
 */
export function searchPopularClubs(query: string): ClubPreset[] {
  if (!query || query.trim().length === 0) return POPULAR_FINNISH_CLUBS.slice(0, 6);
  const q = query.toLowerCase().trim();
  return POPULAR_FINNISH_CLUBS.filter(
    (club) =>
      club.name.toLowerCase().includes(q) ||
      club.shortName.toLowerCase().includes(q) ||
      club.city.toLowerCase().includes(q) ||
      club.sport.toLowerCase().includes(q)
  );
}
