export type SportType =
  | 'football'
  | 'floorball'
  | 'basketball'
  | 'volleyball'
  | 'icehockey'
  | 'futsal'
  | 'training'
  | 'other';

export type EventType = 'match' | 'training' | 'tournament' | 'meeting' | 'other';

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

export interface MatchGoal {
  minute: number;
  player: string;
  team: 'home' | 'away';
  isPenalty?: boolean;
  isOwnGoal?: boolean;
  assistPlayer?: string;
}

export interface TeamMatchStats {
  possessionPercent: number; // e.g. 57% vs 43%
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

export interface CommonOpponentComparison {
  opponentName: string;
  homeResult: { result: 'win' | 'draw' | 'loss'; score: string };
  awayResult: { result: 'win' | 'draw' | 'loss'; score: string };
}

export interface PlayerDetailedStats {
  jerseyNumber: number;
  playerName: string;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  goals: number;
  assists: number;
  matchesPlayed: number;
  yellowCards: number;
  redCards: number;
  isCaptain?: boolean;
  isStartingLineup?: boolean;
}

export interface TeamSquadRoster {
  teamName: string;
  coachName?: string;
  players: PlayerDetailedStats[];
}

export interface FullMatchStats {
  leagueName: string; // e.g., "Lentopalloliitto N2 Torneopal"
  round?: string;
  scoreType?: 'goals' | 'sets' | 'points'; // Football/Floorball: goals, Volleyball: sets, Basketball: points
  setScores?: string[]; // e.g. ["25-22", "23-25", "25-18", "25-20"]
  liveScore?: {
    home: number;
    away: number;
    isLive: boolean;
    period?: string;
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
  commonOpponents: CommonOpponentComparison[];
  squadRosters: {
    home: TeamSquadRoster;
    away: TeamSquadRoster;
  };
  divisionRosters: Record<string, TeamSquadRoster>;
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

// ============================================================================
// SPORTS ASSOCIATION & OFFICIAL LEAGUE DATA TYPES (Milestone 1 / Dexie v2)
// ============================================================================

export type AssociationType = 'palloliitto' | 'salibandy' | 'basket' | 'torneopal';

export interface ParsedAssociationUrl {
  sport: SportType;
  association: AssociationType;
  teamId: string;
  subdomain?: string; // for *.torneopal.fi
  canonicalUrl: string;
  seasonId?: string;
  leagueId?: string;
  tab?: string;
}

export interface OfficialLeagueFixture {
  id: string; // Deterministic: `${association}_${teamId}_${matchId}`
  teamId: string;
  association: AssociationType;
  sport: SportType;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
  startTime: string; // ISO 8601 string
  endTime?: string;
  venueName: string;
  fieldNumber?: string;
  venueLat?: number;
  venueLng?: number;
  venueCity?: string;
  competitionId?: string;
  categoryId?: string;
  groupId?: string;
  status: 'upcoming' | 'played' | 'cancelled' | 'postponed';
  score?: string;
  homeScore?: number;
  awayScore?: number;
  setScores?: string[];
  officialMatchUrl?: string;
  matchId?: string;
  round?: string;
  fetchedAt: string; // ISO 8601 string
}

export interface LeagueStandingsRecord {
  id: string; // `${teamId}_${leagueName}`
  teamId: string;
  leagueName: string;
  rows: StandingRow[];
  fetchedAt: string; // ISO 8601 string
}

export interface TeamRosterRecord extends TeamSquadRoster {
  id: string; // `${teamId}`
  teamId: string;
  fetchedAt: string; // ISO 8601 string
}

export interface OfficialTeamData {
  teamId: string;
  association: AssociationType;
  sport: SportType;
  teamName?: string;
  leagueName?: string;
  season?: string;
  fixtures: OfficialLeagueFixture[];
  standings?: StandingRow[];
  roster?: TeamSquadRoster;
  divisionRosters?: Record<string, TeamSquadRoster>;
  topScorers?: TopScorer[];
  competitionId?: string;
  categoryId?: string;
  groupId?: string;
  sourceUrl?: string;
  fetchedAt?: string;
}

// ============================================================================
// RECONCILIATION & CONFLICT TYPES (Milestone 1 & 3)
// ============================================================================

export type ReconciliationStatus =
  | 'auto_matched'
  | 'candidate_match'
  | 'manual_matched'
  | 'conflict_mismatch'
  | 'unlinked';

export interface MismatchFlags {
  timeMismatch?: boolean;
  timeDiffMinutes?: number;
  officialStartTime?: string;
  calendarStartTime?: string;
  venueMismatch?: boolean;
  officialVenueName?: string;
  calendarVenueName?: string;
  opponentMismatch?: boolean;
  officialOpponent?: string;
  calendarOpponent?: string;
  dateMismatch?: boolean;
}

export interface UserOverrideDecision {
  action: 'adopt_official' | 'keep_calendar' | 'unlink' | 'custom';
  appliedAt: string; // ISO 8601 string
  notes?: string;
  overriddenFields?: {
    startTime?: string;
    venue?: VenueInfo;
    homeTeam?: string;
    awayTeam?: string;
  };
}

export interface MismatchDiagnostics {
  hasKickoffMismatch: boolean;
  calendarStartTime: string;
  officialStartTime?: string;
  timeDiffMinutes?: number;
  hasVenueMismatch: boolean;
  calendarVenueName?: string;
  officialVenueName?: string;
  hasOpponentMismatch: boolean;
  calendarOpponent?: string;
  officialOpponent?: string;
}

export interface ReconciliationResult {
  status: 'auto_matched' | 'candidate_match' | 'unlinked';
  confidenceScore: number; // 0.0 - 1.0
  officialFixture?: OfficialLeagueFixture;
  mismatches?: MismatchDiagnostics;
}

// ============================================================================
// ARRIVAL & WARMUP RULES (Milestone 1 & 2)
// ============================================================================

export interface WarmupOffsets {
  homeMatch: number;      // Default: 45 (minutes before kickoff)
  awayMatch: number;      // Default: 60 (minutes before kickoff)
  training: number;       // Default: 15 (minutes before session)
  tournament?: number;    // Default: 60 (minutes before first match)
}

export interface ArrivalRules {
  profileId: string;
  defaultSport: SportType;
  warmupOffsetsMinutes: WarmupOffsets;
  departureBufferMinutes: number; // Default: 15 (extra buffer for parking/traffic)
  squadAliases?: string[];        // e.g. ["Sininen", "Kilpa", "T13"]
  excludedSquadKeywords?: string[]; // e.g. ["Valkoinen"]
  autoSurfaceDuty?: boolean;     // Default: true
  preferredRoles?: string[];      // e.g. ["kahvio", "kirjuri"]
  customNotes?: string;
  updatedAt?: string;             // ISO 8601 string

  // Legacy / convenience fields
  warmupOffsetHomeMinutes?: number;
  warmupOffsetAwayMinutes?: number;
  warmupOffsetTrainingMinutes?: number;
  warmupOffsetTournamentMinutes?: number;
  volunteerDutyArrivalBufferMinutes?: number;
  defaultDrivingEstimateMinutes?: number;
  defaultDepartureBufferMinutes?: number;
  squadFilters?: string[];
}

export interface VolunteerDutyResult {
  dutyTag: string; // e.g. "☕ Kahviovuoro (klo 14:30 - 16:00)"
  role: 'kahvio' | 'toimitsija' | 'kello_kirjuri' | 'jarjestysmies' | 'kioski' | 'kyyti' | 'makkara' | 'striimaus' | 'ensiapu';
  timeWindow?: string;
}

export interface ParsedTitleResult {
  eventType: EventType;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  embeddedVenueHint?: string;
  roundInfo?: string;
  isFriendly?: boolean;
}

// ============================================================================
// UPDATED CORE ENTITY INTERFACES
// ============================================================================

export interface PlayerProfile {
  id: string;
  playerName: string;
  teamName: string;
  sport: SportType;
  primaryColor: string; // e.g., 'punainen'
  secondaryColor?: string; // e.g., 'valkoinen'
  calendarUrl: string;
  colorHex: string;

  // Milestone 1 additions:
  associationUrl?: string;
  associationType?: AssociationType;
  teamId?: string;
  clubId?: string;
  squadName?: string;
  lastOfficialSyncAt?: string;
}

export interface PlayerMatchLog {
  goals?: number;
  assists?: number;
  points?: number;
  saves?: number;
  minutesPlayed?: number;
  starPlayerAward?: boolean; // Tsemppari / Ottelun tähti
  notes?: string;
  loggedAt?: string;
}

export interface MatchdayEvent {
  id: string;
  profileId: string;
  sport: SportType;
  eventType: EventType;
  isTraining: boolean;
  title: string;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  startTime: string; // ISO 8601
  endTime: string;
  warmupTime: string; // ISO 8601
  tournamentName?: string;
  stage?: string; // e.g. "P14 Haastaja Lohko B" or "Jatko-ottelut"
  matchNumber?: string; // e.g. "227"
  score?: string; // e.g. "2–12", "4–9", "7–3"
  venue: VenueInfo;
  volunteerDuty?: string; // e.g. "☕ Kahviovuoro (klo 11:30 - 13:00)"
  weather?: WeatherCondition;
  lightning?: LightningSafetyAlert;
  parking?: ParkingInfo;
  stats?: FullMatchStats;
  playerLog?: PlayerMatchLog;
  briefing?: MatchdayBriefing;

  // Milestone 1 & 3 additions:
  officialFixtureId?: string;
  reconciliationStatus?: ReconciliationStatus;
  confidenceScore?: number;
  mismatchFlags?: MismatchFlags;
  userOverride?: UserOverrideDecision;
}


