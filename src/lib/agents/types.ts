import type { MatchdayEvent, PlayerProfile, SportType } from '../../types/matchday';

export type AgentId =
  | 'planner'
  | 'calendar'
  | 'weatherSafety'
  | 'logistics'
  | 'kit'
  | 'volunteer'
  | 'conflict'
  | 'carpool'
  | 'tournament'
  | 'ambient'
  | 'stats';

export type ConflictSeverity = 'info' | 'warn' | 'critical';

export interface FamilyConflict {
  id: string;
  severity: ConflictSeverity;
  childA: string;
  childB: string;
  eventAId: string;
  eventBId: string;
  venueA: string;
  venueB: string;
  overlapMinutes: number;
  travelMinutesEstimate: number;
  message: string;
  suggestedFix: string;
}

export interface CarpoolLeg {
  time: string;
  leaveBy: string;
  childName: string;
  profileId: string;
  eventId: string;
  venueName: string;
  action: string;
  driverSlot: 'kuski-1' | 'kuski-2' | 'yhteiskyyti' | 'oma-kyyti';
  canShareRideWith?: string;
}

export interface KitItem {
  id: string;
  label: string;
  why: string;
  required: boolean;
  weatherDriven: boolean;
  packed?: boolean;
}

export interface SportKitPlan {
  sport: SportType;
  footwearLabel: string;
  footwearWhy: string;
  kitSet: 'ykkönen' | 'vieras' | 'treeni';
  kitColors: { primary: string; secondary?: string };
  playerItems: KitItem[];
  spectatorItems: KitItem[];
}

export interface TalkooShift {
  eventId: string;
  profileId: string;
  childName: string;
  role: string;
  roleLabel: string;
  timeWindow?: string;
  venueName: string;
  startTime: string;
  loadScore: number;
}

export interface TalkooBalance {
  overloadedParent: boolean;
  shifts: TalkooShift[];
  perChild: Array<{ childName: string; count: number; roles: string[] }>;
  recommendation: string;
}

export interface TournamentBlock {
  id: string;
  name: string;
  date: string;
  venueName: string;
  childName: string;
  profileId: string;
  colorHex: string;
  matchCount: number;
  firstKickoff: string;
  lastEnd: string;
  recoveryMinutes: number;
  eventIds: string[];
  leaveBy: string;
  packingNote: string;
}

export interface WeekendDayStrip {
  date: string;
  weekday: string;
  label: string;
  events: Array<{
    eventId: string;
    time: string;
    childName: string;
    colorHex: string;
    sport: SportType;
    title: string;
    venueName: string;
    isTalkoo: boolean;
  }>;
}

export interface MissionControlSnapshot {
  generatedAt: string;
  weekendLabel: string;
  nextEvent?: MatchdayEvent;
  nextPlayer?: PlayerProfile;
  leaveBy?: string;
  leaveCountdownMinutes?: number;
  conflicts: FamilyConflict[];
  carpool: CarpoolLeg[];
  talkoo: TalkooBalance;
  tournaments: TournamentBlock[];
  days: WeekendDayStrip[];
  kitByEventId: Record<string, SportKitPlan>;
  ambientLine: string;
  whatsAppShareText: string;
  summary: string;
}

export interface AgentContext {
  events: MatchdayEvent[];
  profiles: PlayerProfile[];
  now: Date;
}
