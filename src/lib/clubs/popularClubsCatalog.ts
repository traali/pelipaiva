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
  },

  // 🏒 Ice Hockey
  {
    id: 'icehockey-default',
    name: 'Jääkiekkojoukkue (Torneopal / Leijonat)',
    shortName: 'Jääkiekko',
    city: 'Koko Suomi',
    sport: 'icehockey',
    primaryColor: 'sininen',
    colorHex: '#1e3a8a',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40101',
    popularAgeGroups: ['U14', 'U13', 'U12', 'U11']
  },
  {
    id: 'hifk-hockey',
    name: 'HIFK Ishockey Juniorit (HIFK)',
    shortName: 'HIFK',
    city: 'Helsinki',
    sport: 'icehockey',
    primaryColor: 'punainen',
    colorHex: '#dc2626',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40102',
    popularAgeGroups: ['U14 Red', 'U13 White', 'U12 Blue', 'Stadin Gimmat']
  },
  {
    id: 'jokerit-hockey',
    name: 'Jokerit Juniorit',
    shortName: 'Jokerit',
    city: 'Helsinki',
    sport: 'icehockey',
    primaryColor: 'sininen',
    colorHex: '#1d4ed8',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40103',
    popularAgeGroups: ['U14', 'U13', 'U12']
  },
  {
    id: 'kiekko-espoo',
    name: 'Kiekko-Espoo Juniorit (K-Espoo)',
    shortName: 'K-Espoo',
    city: 'Espoo',
    sport: 'icehockey',
    primaryColor: 'sininen',
    colorHex: '#1e3a8a',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40101',
    popularAgeGroups: ['U14 Blues', 'U13 EKS', 'U12 EPS', 'Naiset']
  },
  {
    id: 'tappara',
    name: 'Tappara Juniorit',
    shortName: 'Tappara',
    city: 'Tampere',
    sport: 'icehockey',
    primaryColor: 'oranssi',
    colorHex: '#ea580c',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40200',
    popularAgeGroups: ['U14 Sininen', 'U13 Oranssi', 'U12']
  },
  {
    id: 'ilves-hockey',
    name: 'Tampereen Ilves (Jääkiekko)',
    shortName: 'Ilves Hockey',
    city: 'Tampere',
    sport: 'icehockey',
    primaryColor: 'vihreä',
    colorHex: '#15803d',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40201',
    popularAgeGroups: ['U14 Keltainen', 'U13 Vihreä', 'U12']
  },
  {
    id: 'tps-hockey',
    name: 'TPS Juniorijääkiekko',
    shortName: 'TPS Hockey',
    city: 'Turku',
    sport: 'icehockey',
    primaryColor: 'mustavalkoinen',
    colorHex: '#18181b',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40300',
    popularAgeGroups: ['U14 Musta', 'U13 Valkoinen', 'U12']
  },
  {
    id: 'karpat',
    name: 'Oulun Kärpät 46',
    shortName: 'Kärpät',
    city: 'Oulu',
    sport: 'icehockey',
    primaryColor: 'keltainen',
    colorHex: '#eab308',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40400',
    popularAgeGroups: ['U14 Musta', 'U13 Keltainen', 'U12']
  },
  {
    id: 'pelicans',
    name: 'JuniorPelicans',
    shortName: 'Pelicans',
    city: 'Lahti',
    sport: 'icehockey',
    primaryColor: 'turkoosi',
    colorHex: '#06b6d4',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40500',
    popularAgeGroups: ['U14 Turkoosi', 'U13', 'U12']
  },
  {
    id: 'kalpa',
    name: 'Junior-KalPa',
    shortName: 'KalPa',
    city: 'Kuopio',
    sport: 'icehockey',
    primaryColor: 'keltainen',
    colorHex: '#eab308',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40600',
    popularAgeGroups: ['U14 Keltainen', 'U13 Musta', 'U12']
  },
  {
    id: 'jyp',
    name: 'JYP Juniorit',
    shortName: 'JYP',
    city: 'Jyväskylä',
    sport: 'icehockey',
    primaryColor: 'punainen',
    colorHex: '#b91c1c',
    sampleTeamUrl: 'https://hockey.torneopal.fi/taso/joukkue.php?joukkue=40700',
    popularAgeGroups: ['U14 Punainen', 'U13 Musta', 'U12']
  },

  // 👟 Futsal
  {
    id: 'futsal-default',
    name: 'Futsaljoukkue (Palloliitto / Torneopal)',
    shortName: 'Futsal',
    city: 'Koko Suomi',
    sport: 'futsal',
    primaryColor: 'keltainen',
    colorHex: '#eab308',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3321',
    popularAgeGroups: ['P14 Futsal', 'T13 Futsal', 'P12 Futsal', 'Edustus']
  },
  {
    id: 'kady',
    name: 'Kampuksen Dynamo (KaDy Futsal)',
    shortName: 'KaDy',
    city: 'Jyväskylä',
    sport: 'futsal',
    primaryColor: 'punainen',
    colorHex: '#dc2626',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3322',
    popularAgeGroups: ['P15', 'T14', 'P13', 'Edustus']
  },
  {
    id: 'akaa-futsal',
    name: 'Akaa Futsal',
    shortName: 'Akaa',
    city: 'Akaa',
    sport: 'futsal',
    primaryColor: 'sininen',
    colorHex: '#2563eb',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3323',
    popularAgeGroups: ['P14', 'P12', 'Edustus']
  },
  {
    id: 'gft',
    name: 'Golden Futsal Team (GFT)',
    shortName: 'GFT',
    city: 'Espoo',
    sport: 'futsal',
    primaryColor: 'keltainen',
    colorHex: '#eab308',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3321',
    popularAgeGroups: ['P14 Kulta', 'T13 Kulta', 'P12', 'Edustus']
  },
  {
    id: 'mad-max',
    name: 'Futsal Mad Max',
    shortName: 'Mad Max',
    city: 'Valkeakoski',
    sport: 'futsal',
    primaryColor: 'mustavalkoinen',
    colorHex: '#18181b',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3324',
    popularAgeGroups: ['P14', 'P13', 'Edustus']
  },
  {
    id: 'fc-kemi',
    name: 'FC Kemi Futsal',
    shortName: 'FC Kemi',
    city: 'Kemi',
    sport: 'futsal',
    primaryColor: 'punainen',
    colorHex: '#b91c1c',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3325',
    popularAgeGroups: ['P14', 'P12', 'Edustus']
  },
  {
    id: 'vieska-futsal',
    name: 'Vieska Futsal',
    shortName: 'Vieska',
    city: 'Ylivieska',
    sport: 'futsal',
    primaryColor: 'keltainen',
    colorHex: '#ca8a04',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3326',
    popularAgeGroups: ['P14', 'P12', 'Edustus']
  },
  {
    id: 'topv',
    name: 'Tornion Palloveikot (ToPV Futsal)',
    shortName: 'ToPV',
    city: 'Tornio',
    sport: 'futsal',
    primaryColor: 'vihreä',
    colorHex: '#16a34a',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3327',
    popularAgeGroups: ['P14', 'P12', 'Edustus']
  },
  {
    id: 'ilves-fs',
    name: 'Ilves FS (Futsal)',
    shortName: 'Ilves FS',
    city: 'Tampere',
    sport: 'futsal',
    primaryColor: 'vihreä',
    colorHex: '#15803d',
    sampleTeamUrl: 'https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3328',
    popularAgeGroups: ['T14', 'P13', 'Edustus']
  }
];

const SPORT_SYNONYMS: Record<SportType, string[]> = {
  football: ['futis', 'jalkapallo', 'football', 'soccer'],
  floorball: ['säbä', 'sähly', 'salibandy', 'floorball'],
  basketball: ['koris', 'koripallo', 'basket', 'basketball'],
  volleyball: ['lentis', 'lentopallo', 'volley', 'volleyball'],
  icehockey: ['lätkä', 'kiekko', 'jääkiekko', 'jaakiekko', 'hockey', 'icehockey'],
  futsal: ['futsal'],
  training: ['treeni', 'harjoitus', 'fysiikka'],
  school: ['koulu', 'wilma'],
  other: ['muu']
};

/**
 * Searches the popular clubs catalog by keyword, city, or optional sport filter.
 */
export function searchPopularClubs(query: string, sport?: SportType): ClubPreset[] {
  const pool = sport
    ? POPULAR_FINNISH_CLUBS.filter((c) => c.sport === sport)
    : POPULAR_FINNISH_CLUBS;

  if (!query || query.trim().length === 0) {
    return pool.slice(0, 6);
  }
  const q = query.toLowerCase().trim();
  return pool.filter((club) => {
    const synonyms = SPORT_SYNONYMS[club.sport] || [];
    return (
      club.name.toLowerCase().includes(q) ||
      club.shortName.toLowerCase().includes(q) ||
      club.city.toLowerCase().includes(q) ||
      club.sport.toLowerCase().includes(q) ||
      synonyms.some((syn) => syn.includes(q) || q.includes(syn))
    );
  });
}
