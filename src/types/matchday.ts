export type SportType = 'football' | 'floorball' | 'basketball' | 'futsal' | 'icehockey' | 'training' | 'other';

export type PitchSurface =
  | 'artificial_turf_3g'
  | 'sand_artificial_turf'
  | 'natural_grass'
  | 'indoor_parquet'
  | 'indoor_synthetic'
  | 'gravel';

export type FootwearRecommendation =
  | 'AG_ARTIFICIAL_GRASS'
  | 'FG_FIRM_GROUND'
  | 'SG_SOFT_GROUND'
  | 'TF_TURF_SHOES'
  | 'INDOOR_NON_MARKING';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface VenueInfo {
  name: string;
  normalizedName: string;
  address?: string;
  postalCode?: string;
  city?: string;
  coordinates: Coordinates;
  isIndoor: boolean;
  surface: PitchSurface;
  hasFloodlights: boolean;
  lipasId?: number;
  isUserPinned?: boolean;
}

export interface RainDataPoint {
  time: string; // ISO 8601
  precipitationMmh: number;
}

export interface WeatherCondition {
  temperatureC: number;
  feelsLikeC: number;
  windSpeedMs: number;
  windGustMs: number;
  rainProbabilityPercent: number;
  precipitationMmh: number;
  rainTimeline: RainDataPoint[];
  turfCondition: 'dry' | 'slick' | 'frozen' | 'snowy';
  uvIndex?: number;
  isForecastLongRange?: boolean;
}

export interface LightningSafetyAlert {
  status: 'clear' | 'watch' | 'danger';
  nearestStrikeKm?: number;
  strikesWithin30kmCount: number;
  suspendMatchRecommended: boolean;
  resumeCountdownMinutes?: number; // 30-30 Rule
  downpourWarning: boolean;
  alertMessage?: string;
}

export interface ParkingInfo {
  easeScore: 'easy' | 'moderate' | 'tight';
  easeScoreValue: number; // 1 to 100
  lotName: string;
  coordinates: Coordinates;
  feeZone: string;
  parkingDiscRequired: boolean;
  maxParkingHours?: number;
  walkingTimeMinutes: number;
  walkingDistanceMeters: number;
  warnings: string[];
  mapsNavigationUrl: string;
}

export interface PlayerProfile {
  id: string;
  playerName: string;
  teamName: string;
  sport: SportType;
  primaryColor: string; // e.g., 'punainen'
  secondaryColor?: string; // e.g., 'valkoinen'
  calendarUrl: string;
  colorHex: string;
}

export interface MatchGoal {
  minute: number;
  player: string;
  team: 'home' | 'away';
  isPenalty?: boolean;
  isOwnGoal?: boolean;
  assistPlayer?: string;
}

export interface TeamMatchStats {
  possessionPercent: number; // e.g. 58 vs 42
  shotsTotal: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  offsides?: number;
}

export interface StandingRow {
  rank: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface TopScorer {
  rank: number;
  playerName: string;
  teamName: string;
  goals: number;
  matchesPlayed: number;
}

export interface HeadToHeadMatch {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface FullMatchStats {
  leagueName: string; // e.g., "Palloliitto T13 Ykkönen (Lohko 1)"
  round?: string; // e.g., "Kierros 8 / 14"
  liveScore?: {
    home: number;
    away: number;
    isLive: boolean;
    period?: string; // "1. puoliaika", "2. puoliaika", "Päättynyt"
  };
  goalsTimeline?: MatchGoal[];
  teamStats?: {
    home: TeamMatchStats;
    away: TeamMatchStats;
  };
  homeStanding: StandingRow;
  awayStanding: StandingRow;
  standingsTable: StandingRow[];
  topScorers: TopScorer[];
  headToHeadHistory: HeadToHeadMatch[];
  scoutAnalysis: string;
}

export interface MatchdayBriefing {
  scoutSummary: string;
  gearAndPackingAdvice: {
    clothing: string;
    footwear: FootwearRecommendation;
    footwearReason: string;
    kitRecommendation: string;
    spectatorGear: string;
  };
  recommendedDepartureTime: string;
  departureCountdownMinutes: number;
  conflictWarning?: string;
  postMatchWhatsAppTemplate: string;
}

export interface MatchdayEvent {
  id: string;
  profileId: string;
  sport: SportType;
  title: string;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  startTime: string; // ISO 8601
  endTime: string;
  warmupTime: string; // ISO 8601
  tournamentName?: string;
  venue: VenueInfo;
  volunteerDuty?: string; // e.g. "☕ Kahviovuoro (klo 11:30 - 13:00)"
  weather?: WeatherCondition;
  lightning?: LightningSafetyAlert;
  parking?: ParkingInfo;
  stats?: FullMatchStats;
  briefing?: MatchdayBriefing;
}
