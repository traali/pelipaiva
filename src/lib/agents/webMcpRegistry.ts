/**
 * WebMCP tools for Pelipäivä (imperative API, early preview).
 * https://developer.chrome.com/docs/ai/webmcp/imperative-api
 *
 * - Uses the browser's own `document.modelContext` (Chromium 146+, behind
 *   chrome://flags/#enable-webmcp-testing, HTTPS only). Older builds exposed
 *   `navigator.modelContext`; used only if it exists.
 * - Without it this is a no-op: no polyfill, no globals, no host objects
 *   replaced, no postMessage bridge (any frame could call tools through one).
 * - Tools are unregistered by aborting the AbortSignal passed to registerTool.
 * - Every tool reads only what is stored on this device (Dexie). Missing data
 *   stays null; nothing is estimated or filled in.
 */

import { db as defaultDb, type PelipaivaDB } from '../storage/db';
import { eventDayKey, helsinkiDateISO } from './time';
import { federationMatchLinks } from '../sport/federationLinks';

export interface WebMcpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  annotations?: WebMcpToolAnnotations;
  execute: (input: Record<string, unknown>, client?: unknown) => Promise<WebMcpToolResult>;
}

/** The part of the browser's ModelContext we use. */
export interface ModelContextLike {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown;
}

function asModelContext(value: unknown): ModelContextLike | null {
  return value && typeof (value as { registerTool?: unknown }).registerTool === 'function'
    ? (value as ModelContextLike)
    : null;
}

/** document.modelContext, else a legacy navigator.modelContext, else null. */
export function getModelContext(): ModelContextLike | null {
  const fromDocument =
    typeof document !== 'undefined' ? asModelContext((document as unknown as { modelContext?: unknown }).modelContext) : null;
  if (fromDocument) return fromDocument;
  return typeof navigator !== 'undefined'
    ? asModelContext((navigator as unknown as { modelContext?: unknown }).modelContext)
    : null;
}

function textResult(value: unknown): WebMcpToolResult {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string): WebMcpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildPelipaivaTools(database: PelipaivaDB = defaultDb): WebMcpTool[] {
  const getMatchdaySchedule: WebMcpTool = {
    name: 'get_matchday_schedule',
    description:
      'Lists the junior sports games, trainings and other events saved in this Pelipäivä app for one day ' +
      '(Europe/Helsinki). Only stored data: a field the app does not know is null. Team names and titles ' +
      'come from club calendars and federation results services.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Day as YYYY-MM-DD (Europe/Helsinki). Defaults to today.',
        },
        playerName: {
          type: 'string',
          description: 'Optional child name (or part of it) to show only that child.',
        },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (input) => {
      const rawDate = input?.date;
      if (rawDate !== undefined && (typeof rawDate !== 'string' || !ISO_DATE.test(rawDate))) {
        return errorResult('date must be YYYY-MM-DD');
      }
      const targetDate = typeof rawDate === 'string' ? rawDate : helsinkiDateISO();
      const playerFilter = typeof input?.playerName === 'string' ? input.playerName.trim().toLowerCase() : '';

      const [allEvents, allProfiles] = await Promise.all([database.events.toArray(), database.profiles.toArray()]);
      const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

      const events = allEvents
        .filter((ev) => !ev.isHidden && !ev.mergedIntoEventId)
        .filter((ev) => Boolean(ev.startTime) && eventDayKey(ev.startTime) === targetDate)
        .filter((ev) => {
          if (!playerFilter) return true;
          const name = profileMap.get(ev.profileId)?.playerName || '';
          return name.toLowerCase().includes(playerFilter);
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((e) => {
          const profile = profileMap.get(e.profileId);
          const links = federationMatchLinks(e, { associationUrl: profile?.associationUrl });
          return {
            id: e.id,
            title: e.title,
            eventType: e.eventType,
            sport: e.sport,
            playerName: profile?.playerName ?? null,
            homeTeam: e.homeTeam || null,
            awayTeam: e.awayTeam || null,
            startTime: e.startTime,
            endTime: e.endTime || null,
            meetTime: e.warmupTime || null,
            meetTimeIsAppDefault: Boolean(e.warmupIsEstimate),
            venue: e.venue?.name || null,
            venueLocationApproximate: Boolean(e.venue?.isApproximateLocation),
            score: e.score || null,
            attendance: e.attendanceStatus ?? null,
            fromFederation: Boolean(links),
            statsAppUrl: links?.appUrl ?? null,
            federationMatchUrl: links?.federationUrl ?? null,
          };
        });

      return textResult({ date: targetDate, timeZone: 'Europe/Helsinki', count: events.length, events });
    },
  };

  const getFamilyProfiles: WebMcpTool = {
    name: 'get_family_profiles',
    description: 'Lists the child player profiles saved in this Pelipäivä app (name, team, sport).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async () => {
      const profiles = await database.profiles.toArray();
      return textResult({
        count: profiles.length,
        profiles: profiles.map((p) => ({
          id: p.id,
          playerName: p.playerName,
          teamName: p.teamName || null,
          sport: p.sport,
        })),
      });
    },
  };

  return [getMatchdaySchedule, getFamilyProfiles];
}

let activeRegistration: AbortController | null = null;

/** Unregisters every Pelipäivä tool. */
export function unregisterPelipaivaWebMCP(): void {
  activeRegistration?.abort();
  activeRegistration = null;
}

/**
 * Registers the tools with the browser's model context. Returns the
 * AbortController (abort to unregister), or null when WebMCP is not available.
 */
export async function registerPelipaivaWebMCP(database: PelipaivaDB = defaultDb): Promise<AbortController | null> {
  const modelContext = getModelContext();
  if (!modelContext) return null;

  unregisterPelipaivaWebMCP();
  const controller = new AbortController();
  activeRegistration = controller;

  for (const tool of buildPelipaivaTools(database)) {
    try {
      await modelContext.registerTool(tool, { signal: controller.signal });
    } catch (err) {
      console.warn(`[WebMCP] registerTool ${tool.name} failed`, err);
    }
  }
  return controller;
}
