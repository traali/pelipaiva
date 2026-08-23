export interface Env {
  MATCHDAY_KV: KVNamespace;
  /** Comma-separated issued Crockford codes. Empty = no family slots. Never commit values. */
  FAMILY_CODES?: string;
}

export interface SyncPayload {
  syncKey: string;
  updatedAt: string;
  events: Array<{
    id: string;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    warmupTime: string;
    venue: {
      name: string;
      surface?: string;
    };
    briefing?: {
      recommendedDepartureTime?: string;
    };
  }>;
}

export interface FamilyRosterRow {
  id: string;
  playerName: string;
  teamName: string;
  sport: string;
  colorHex: string;
  calendarUrl: string;
  associationUrl?: string;
  associationType?: string;
  teamId?: string;
}

export interface FamilyRosterV1 {
  v: 1;
  rev: number;
  updatedAt: string;
  profiles: FamilyRosterRow[];
  tombstones: Array<{ id: string; deletedAt: string }>;
}

async function parseIssuedFamilyCodes(raw?: string): Promise<Set<string>> {
  const set = new Set<string>();
  if (!raw) return set;
  const codeRegex = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$/;
  for (const part of raw.split(/[,\s]+/)) {
    if (!part.trim()) continue;
    const c = part.trim().toUpperCase();
    const code = c.includes('-') ? c : c.length === 6 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
    if (codeRegex.test(code)) set.add(code);
  }
  return set;
}

const FAMILY_RATE_WINDOW_SEC = 900;
const FAMILY_RATE_LIMITS: Record<string, number> = { GET: 20, PUT: 5, DELETE: 3 };

async function rateLimitFamily(
  request: Request,
  method: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const limit = FAMILY_RATE_LIMITS[method];
  if (!limit) return null;
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';
  const bucket = Math.floor(Date.now() / (FAMILY_RATE_WINDOW_SEC * 1000));
  const cacheKey = new Request(
    `https://pelipaiva-ratelimit.internal/family/${method}/${encodeURIComponent(ip)}/${bucket}`
  );
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  const count = hit ? parseInt(await hit.text(), 10) || 0 : 0;
  if (count >= limit) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Retry-After': String(FAMILY_RATE_WINDOW_SEC)
      }
    });
  }
  await cache.put(
    cacheKey,
    new Response(String(count + 1), {
      headers: { 'Cache-Control': `max-age=${FAMILY_RATE_WINDOW_SEC}` }
    })
  );
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, If-Match, X-Pelipaiva-Rev',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 0. Family Sync Roster API (/api/family/:code)
    if (url.pathname.startsWith('/api/family/')) {
      const rawCode = url.pathname.replace('/api/family/', '').trim().toUpperCase();
      const code = rawCode.includes('-')
        ? rawCode
        : rawCode.length === 6
        ? `${rawCode.slice(0, 5)}-${rawCode.slice(5)}`
        : rawCode;

      // Keep in sync with src/lib/sync/familyCode.ts FAMILY_CODE_REGEX (Crockford-32, no I/L/O/U)
      const codeRegex = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$/;
      if (!codeRegex.test(code)) {
        return new Response(JSON.stringify({ error: 'invalid_code_format' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const limited = await rateLimitFamily(request, request.method, corsHeaders);
      if (limited) return limited;

      const issued = await parseIssuedFamilyCodes(env.FAMILY_CODES);
      if (issued.size === 0 || !issued.has(code)) {
        return new Response(JSON.stringify({ error: 'unknown_family' }), {
          status: 403,
          headers: corsHeaders
        });
      }

      const kvKey = `family:${code}`;

      // GET /api/family/:code
      if (request.method === 'GET') {
        const dataStr = await env.MATCHDAY_KV.get(kvKey);
        if (!dataStr) {
          return new Response(JSON.stringify({ error: 'not_found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        const data = JSON.parse(dataStr) as FamilyRosterV1;
        return new Response(dataStr, {
          headers: {
            ...corsHeaders,
            ETag: `"${data.rev}"`,
            'X-Pelipaiva-Rev': String(data.rev),
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }

      // PUT /api/family/:code
      if (request.method === 'PUT') {
        let body: FamilyRosterV1;
        try {
          body = (await request.json()) as FamilyRosterV1;
        } catch {
          return new Response(JSON.stringify({ error: 'invalid_json' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (!body || body.v !== 1 || !Array.isArray(body.profiles)) {
          return new Response(JSON.stringify({ error: 'invalid_roster_schema' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const existingStr = await env.MATCHDAY_KV.get(kvKey);
        let currentRev = 0;
        if (existingStr) {
          const existing = JSON.parse(existingStr) as FamilyRosterV1;
          currentRev = existing.rev || 0;
          const ifMatch =
            request.headers.get('If-Match')?.replace(/"/g, '') ||
            request.headers.get('X-Pelipaiva-Rev');

          // Existing key: missing or stale If-Match → 409 (never silent overwrite)
          if (!ifMatch || parseInt(ifMatch, 10) !== currentRev) {
            return new Response(
              JSON.stringify({ error: 'rev_conflict', currentRev }),
              {
                status: 409,
                headers: corsHeaders
              }
            );
          }
        }

        const sanitizedProfiles: FamilyRosterRow[] = body.profiles.map((p) => ({
          id: p.id,
          playerName: p.playerName?.trim().slice(0, 30) || 'Pelaaja',
          teamName: p.teamName?.trim().slice(0, 60) || 'Joukkue',
          sport: p.sport || 'football',
          colorHex: p.colorHex || '#10b981',
          calendarUrl: p.calendarUrl || '',
          associationUrl: p.associationUrl || undefined,
          associationType: p.associationType || undefined,
          teamId: p.teamId || undefined
        }));

        const sanitizedTombstones = (body.tombstones || []).map((t) => ({
          id: t.id,
          deletedAt: t.deletedAt || new Date().toISOString()
        }));

        const nextRev = (body.rev && body.rev > currentRev ? body.rev : currentRev + 1);
        const toStore: FamilyRosterV1 = {
          v: 1,
          rev: nextRev,
          updatedAt: new Date().toISOString(),
          profiles: sanitizedProfiles,
          tombstones: sanitizedTombstones
        };

        await env.MATCHDAY_KV.put(kvKey, JSON.stringify(toStore), {
          expirationTtl: 604800 // 7 days sliding TTL
        });

        return new Response(
          JSON.stringify({ success: true, rev: nextRev, updatedAt: toStore.updatedAt }),
          {
            headers: {
              ...corsHeaders,
              ETag: `"${nextRev}"`,
              'X-Pelipaiva-Rev': String(nextRev)
            }
          }
        );
      }

      // DELETE /api/family/:code
      if (request.method === 'DELETE') {
        await env.MATCHDAY_KV.delete(kvKey);
        return new Response(JSON.stringify({ success: true, message: 'Family roster deleted' }), {
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders
      });
    }

    // 1. Sync Snapshot from Local PWA (TTL 7 days)
    if (url.pathname.startsWith('/api/sync/') && request.method === 'PUT') {
      const syncKey = url.pathname.replace('/api/sync/', '');
      if (!syncKey || syncKey.length < 16) {
        return new Response(JSON.stringify({ error: 'Invalid sync key' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const body = (await request.json()) as SyncPayload;
      await env.MATCHDAY_KV.put(`sync:${syncKey}`, JSON.stringify(body), {
        expirationTtl: 604800 // 7 days in seconds
      });
      return new Response(JSON.stringify({ success: true, message: 'Snapshot synced' }), {
        headers: corsHeaders
      });
    }

    // 2. Google Nest Hub Voice / Display Briefing Webhook
    if (url.pathname === '/api/nest/brief') {
      const syncKey = url.searchParams.get('key');
      if (!syncKey) {
        return new Response(
          JSON.stringify({
            fulfillmentResponse: {
              messages: [
                {
                  text: {
                    text: [
                      'Avaa Pelipäivä-sovellus puhelimellasi ja yhdistä keittiönäyttö asetuksista.'
                    ]
                  }
                }
              ]
            }
          }),
          { headers: corsHeaders }
        );
      }

      const dataStr = await env.MATCHDAY_KV.get(`sync:${syncKey}`);
      if (!dataStr) {
        return new Response(
          JSON.stringify({
            fulfillmentResponse: {
              messages: [{ text: { text: ['Tälle päivälle ei löytynyt merkittyjä otteluita.'] } }]
            }
          }),
          { headers: corsHeaders }
        );
      }

      const data = JSON.parse(dataStr) as SyncPayload;
      const todaysEvent = data.events?.[0];

      if (!todaysEvent) {
        return new Response(
          JSON.stringify({
            fulfillmentResponse: {
              messages: [{ text: { text: ['Ei otteluita tänään. Nauti vapaapäivästä!'] } }]
            }
          }),
          { headers: corsHeaders }
        );
      }

      const voiceMessage = `Tänään on ${todaysEvent.sport}ottelu: ${todaysEvent.homeTeam} vastaan ${todaysEvent.awayTeam} kentällä ${todaysEvent.venue?.name}. Suositeltu lähtöaika kotoa on klo ${todaysEvent.briefing?.recommendedDepartureTime || '17:00'}.`;

      return new Response(
        JSON.stringify({
          fulfillmentResponse: {
            messages: [{ text: { text: [voiceMessage] } }]
          }
        }),
        { headers: corsHeaders }
      );
    }

    // 3. Privacy-Preserving Streaming CORS Proxy for Association JSON, .ics & FMI Feeds
    if (url.pathname === '/api/proxy/ics') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      let targetParsed: URL;
      try {
        targetParsed = new URL(targetUrl);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid url parameter' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const host = targetParsed.hostname.toLowerCase();
      const isAllowed =
        host === 'nimenhuuto.com' ||
        host.endsWith('.nimenhuuto.com') ||
        host === 'myclub.fi' ||
        host.endsWith('.myclub.fi') ||
        host === 'opendata.fmi.fi' ||
        host === 'tulospalvelu.palloliitto.fi' ||
        host === 'spl.torneopal.fi' ||
        host === 'tulospalvelu.salibandy.fi' ||
        host === 'salibandy-api.torneopal.net' ||
        host === 'basket.fi' ||
        host === 'www.basket.fi' ||
        host === 'tulospalvelu.basket.fi' ||
        host === 'espooliikkuutournament.fi' ||
        host === 'www.espooliikkuutournament.fi' ||
        host === 'tupa.api.torneopal.com' ||
        host.endsWith('.torneopal.fi') ||
        host.endsWith('.torneopal.net') ||
        host === 'api.lipas.fi' ||
        host === 'api.hel.fi';

      if (!isAllowed) {
        return new Response(JSON.stringify({ error: 'Host not allowed by proxy allowlist' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const outboundHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': request.headers.get('Accept') || 'application/json, text/html, text/calendar, */*',
        'Referer': targetParsed.origin + '/'
      };

      const feedRes = await fetch(targetUrl, {
        headers: outboundHeaders
      });
      const responseBody = await feedRes.text();

      // For public association pages, enable 5-minute edge cache; private iCal feeds stay short
      const isPublicAssociation =
        host.includes('torneopal') ||
        host.includes('palloliitto') ||
        host.includes('salibandy') ||
        host.includes('basket') ||
        host.includes('espooliikkuu') ||
        host.includes('lipas') ||
        host.includes('hel.fi');

      const cacheControlHeader =
        feedRes.status === 200 && isPublicAssociation
          ? 'public, s-maxage=300, stale-while-revalidate=600'
          : feedRes.status === 200
            ? 'private, max-age=60'
            : 'no-store, no-cache, must-revalidate';

      const contentType =
        feedRes.headers.get('Content-Type') ||
        (targetUrl.endsWith('.json') || targetUrl.includes('/rest/') || targetUrl.includes('api.')
          ? 'application/json; charset=utf-8'
          : 'text/calendar; charset=utf-8');

      return new Response(responseBody, {
        status: feedRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': cacheControlHeader
        }
      });
    }

    return new Response(JSON.stringify({ status: 'Pelipäivä Edge API Active' }), {
      headers: corsHeaders
    });
  }
};
