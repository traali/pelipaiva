/**
 * WebMCP Tool Registry for Pelipäivä
 * Standard: W3C Web Machine Learning Working Group & AAIF WebMCP Specification
 * Reference: https://aaif.io/blog/designing-websites-for-ai-agents-with-webmcp
 *
 * Exposes structured browser-level tools to AI user agents via `document.modelContext`.
 */

import { db } from '../storage/db';
import { calculateParkingRiskContract } from '../../types/contracts';

// WebMCP Type Declarations (W3C Standard Draft)
declare global {
  interface ModelContextTool {
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    execute: (args: Record<string, unknown>) => Promise<unknown>;
  }

  interface Document {
    modelContext?: {
      registerTool: (tool: ModelContextTool) => Promise<void> | void;
      unregisterTool?: (name: string) => Promise<void> | void;
      getTools?: () => ModelContextTool[];
    };
  }
}

/**
 * Register all Pelipäivä WebMCP tools with the browser agent context.
 */
export async function registerPelipaivaWebMCP(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Polyfill / Mock container for inspection if native browser agent runtime is not yet active
  if (!document.modelContext) {
    const registeredTools: ModelContextTool[] = [];
    document.modelContext = {
      registerTool: async (tool: ModelContextTool) => {
        registeredTools.push(tool);
        // Dispatch custom event for browser extensions or AI agent sidecars
        window.dispatchEvent(
          new CustomEvent('webmcp:tool_registered', { detail: { toolName: tool.name } })
        );
      },
      getTools: () => [...registeredTools],
    };
  }

  try {
    // 1. Tool: get_matchday_schedule
    await document.modelContext.registerTool({
      name: 'get_matchday_schedule',
      description: 'Returns the list of junior sports matches, training sessions, and school events for the family matchday schedule.',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Optional ISO date string (YYYY-MM-DD) to filter events. Defaults to today.',
          },
          playerName: {
            type: 'string',
            description: 'Optional player name to filter events for a specific child.',
          },
        },
      },
      execute: async ({ date, playerName }) => {
        const targetDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
        const allEvents = await db.events.toArray();
        const filtered = allEvents.filter((ev) => {
          const matchDate = ev.startTime ? ev.startTime.split('T')[0] : '';
          const matchesDate = !date || matchDate === targetDate;
          const matchesPlayer =
            !playerName || (typeof playerName === 'string' && ev.playerName?.toLowerCase().includes(playerName.toLowerCase()));
          return matchesDate && matchesPlayer;
        });

        return {
          date: targetDate,
          count: filtered.length,
          events: filtered.map((e) => ({
            id: e.id,
            title: e.title,
            sport: e.sport,
            homeTeam: e.homeTeam,
            awayTeam: e.awayTeam,
            startTime: e.startTime,
            venue: e.venue?.name || 'Kenttä',
            attendanceStatus: e.attendanceStatus || 'in',
            source: e.source,
          })),
        };
      },
    });

    // 2. Tool: check_parking_risk
    await document.modelContext.registerTool({
      name: 'check_parking_risk',
      description: 'Calculates parking safety score (1-10 risk rating), zone rules, and fine likelihood for a sports venue via ParkkiS data contract.',
      inputSchema: {
        type: 'object',
        properties: {
          venueSlug: {
            type: 'string',
            description: 'Identifier or slug of the venue (e.g. "vaiski", "toolon-pallokentta-6").',
          },
          venueName: {
            type: 'string',
            description: 'Human-readable venue name.',
          },
          coordinates: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' },
            },
            required: ['lat', 'lng'],
          },
        },
        required: ['venueSlug', 'coordinates'],
      },
      execute: async ({ venueSlug, venueName, coordinates }) => {
        const slug = String(venueSlug || 'default');
        const name = String(venueName || 'Kenttä');
        const coords = coordinates as { lat: number; lng: number };

        return calculateParkingRiskContract(slug, name, coords);
      },
    });

    // 3. Tool: get_family_profiles
    await document.modelContext.registerTool({
      name: 'get_family_profiles',
      description: 'Lists all registered child/family player profiles in the local Pelipäivä PWA database.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const profiles = await db.profiles.toArray();
        return {
          count: profiles.length,
          profiles: profiles.map((p) => ({
            id: p.id,
            name: p.name,
            defaultSport: p.defaultSport,
            colorHex: p.colorHex,
          })),
        };
      },
    });

    console.log('✨ [WebMCP] Successfully registered Pelipäivä AI agent tools into document.modelContext');
  } catch (err) {
    console.warn('[WebMCP] Failed to register WebMCP tools:', err);
  }
}
