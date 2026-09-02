/**
 * WebMCP Tool Registry for Pelipäivä
 * Standard: W3C Web Machine Learning Working Group & AAIF WebMCP Specification
 * Reference: https://aaif.io/blog/designing-websites-for-ai-agents-with-webmcp
 *
 * Exposes structured browser-level tools to AI user agents via `document.modelContext`.
 */

import { db } from '../storage/db';
import { calculateParkingRiskContract } from '../../types/contracts';

// WebMCP Type Declarations (W3C Standard Draft & Anthropic MCP Protocol)
export interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ModelContextRegistry {
  registerTool: (tool: ModelContextTool) => Promise<void> | void;
  unregisterTool?: (name: string) => Promise<void> | void;
  getTools: () => ModelContextTool[];
  listTools: () => Promise<{ tools: Array<{ name: string; description: string; inputSchema: ModelContextTool['inputSchema'] }> }>;
  callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
  executeTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: ModelContextRegistry;
  }
  interface Navigator {
    modelContext?: ModelContextRegistry;
  }
  interface Window {
    modelContext?: ModelContextRegistry;
  }
}

/**
 * Ensures a shared ModelContextRegistry instance is mounted on document, navigator, and window.
 */
function ensureModelContextRegistry(): ModelContextRegistry {
  const existing = (typeof document !== 'undefined' && document.modelContext) ||
    (typeof navigator !== 'undefined' && (navigator as any).modelContext) ||
    (typeof window !== 'undefined' && (window as any).modelContext);

  if (existing && typeof existing.registerTool === 'function' && typeof existing.callTool === 'function') {
    return existing;
  }

  const registeredTools = new Map<string, ModelContextTool>();

  const registry: ModelContextRegistry = {
    registerTool: async (tool: ModelContextTool) => {
      registeredTools.set(tool.name, tool);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('webmcp:tool_registered', { detail: { toolName: tool.name } })
        );
      }
    },
    unregisterTool: async (name: string) => {
      registeredTools.delete(name);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('webmcp:tool_unregistered', { detail: { toolName: name } })
        );
      }
    },
    getTools: () => Array.from(registeredTools.values()),
    listTools: async () => ({
      tools: Array.from(registeredTools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }),
    callTool: async (params: { name: string; arguments?: Record<string, unknown> }) => {
      const tool = registeredTools.get(params.name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Error: Tool '${params.name}' not found in WebMCP registry.` }],
          isError: true,
        };
      }
      try {
        const rawResult = await tool.execute(params.arguments || {});
        return {
          content: [{
            type: 'text',
            text: typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult, null, 2),
          }],
          isError: false,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error executing '${params.name}': ${err?.message || String(err)}` }],
          isError: true,
        };
      }
    },
    executeTool: async (name: string, args: Record<string, unknown> = {}) => {
      const tool = registeredTools.get(name);
      if (!tool) {
        throw new Error(`WebMCP Tool '${name}' is not registered.`);
      }
      return tool.execute(args);
    },
  };

  // Bind to document.modelContext
  if (typeof document !== 'undefined') {
    document.modelContext = registry;
  }

  // Bind to navigator.modelContext for standard browser detection
  if (typeof navigator !== 'undefined') {
    try {
      Object.defineProperty(navigator, 'modelContext', {
        value: registry,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    } catch {
      (navigator as any).modelContext = registry;
    }
  }

  // Bind to window.modelContext and enable cross-boundary message listeners
  if (typeof window !== 'undefined') {
    (window as any).modelContext = registry;

    window.addEventListener('message', async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'webmcp:request' || !data.id) return;

      try {
        if (data.method === 'tools/list' || data.method === 'listTools') {
          const result = await registry.listTools();
          window.postMessage({ type: 'webmcp:response', id: data.id, result }, '*');
        } else if (data.method === 'tools/call' || data.method === 'callTool') {
          const result = await registry.callTool(data.params || { name: '', arguments: {} });
          window.postMessage({ type: 'webmcp:response', id: data.id, result }, '*');
        }
      } catch (err: any) {
        window.postMessage({
          type: 'webmcp:response',
          id: data.id,
          error: { message: err?.message || 'WebMCP execution failed' },
        }, '*');
      }
    });

    window.dispatchEvent(
      new CustomEvent('webmcp:ready', { detail: { location: 'navigator.modelContext & document.modelContext' } })
    );
  }

  return registry;
}

/**
 * Register all Pelipäivä WebMCP tools with the browser agent context.
 */
export async function registerPelipaivaWebMCP(): Promise<ModelContextRegistry | undefined> {
  if (typeof window === 'undefined') return;

  const registry = ensureModelContextRegistry();

  try {
    // 1. Tool: get_matchday_schedule
    await registry.registerTool({
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
        const [allEvents, allProfiles] = await Promise.all([db.events.toArray(), db.profiles.toArray()]);
        const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

        const filtered = allEvents.filter((ev) => {
          const matchDate = ev.startTime ? ev.startTime.split('T')[0] : '';
          const matchesDate = !date || matchDate === targetDate;
          const pName = profileMap.get(ev.profileId)?.playerName || '';
          const matchesPlayer =
            !playerName || (typeof playerName === 'string' && pName.toLowerCase().includes(playerName.toLowerCase()));
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
            playerName: profileMap.get(e.profileId)?.playerName || '',
            isOfficial: Boolean(e.officialFixtureId),
          })),
        };
      },
    });

    // 2. Tool: check_parking_risk
    await registry.registerTool({
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
    await registry.registerTool({
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
            playerName: p.playerName,
            teamName: p.teamName,
            sport: p.sport,
            colorHex: p.colorHex,
          })),
        };
      },
    });

    console.log('✨ [WebMCP] Successfully registered Pelipäivä AI agent tools into navigator.modelContext & document.modelContext');
    return registry;
  } catch (err) {
    console.warn('[WebMCP] Failed to register WebMCP tools:', err);
    return registry;
  }
}
