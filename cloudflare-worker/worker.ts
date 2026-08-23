export interface Env {
  MATCHDAY_KV: KVNamespace;
  /** Comma-separated issued Crockford codes. Empty = no family slots. Never commit values. */
  FAMILY_CODES?: string;
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

function hostnameAllowed(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'nimenhuuto.com' || h.endsWith('.nimenhuuto.com')) return true;
  if (h === 'myclub.fi' || h.endsWith('.myclub.fi')) return true;
  if (h === 'opendata.fmi.fi' || h === 'openwms.fmi.fi') return true;
  if (h === 'api.lipas.fi' || h === 'api.hel.fi') return true;
  if (h === 'tulospalvelu.palloliitto.fi' || h === 'www.tulospalvelu.palloliitto.fi') return true;
  if (h === 'tulospalvelu.salibandy.fi' || h === 'www.tulospalvelu.salibandy.fi') return true;
  if (h === 'basket.fi' || h === 'www.basket.fi' || h === 'tulospalvelu.basket.fi') return true;
  if (h === 'espooliikkuutournament.fi' || h === 'www.espooliikkuutournament.fi') return true;
  if (h === 'tupa.api.torneopal.com' || h === 'salibandy-api.torneopal.net') return true;
  if (h === 'spl.torneopal.fi' || h.endsWith('.torneopal.fi') || h.endsWith('.torneopal.net') || h.endsWith('.torneopal.com')) {
    return true;
  }
  return false;
}

function isAssociationHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes('tulospalvelu.') ||
    h.endsWith('basket.fi') ||
    h.endsWith('torneopal.fi') ||
    h.endsWith('torneopal.net') ||
    h.endsWith('torneopal.com') ||
    h.endsWith('espooliikkuutournament.fi')
  );
}

function isAllowedProxyTarget(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== '443') return false;
  if (/^[\d.]+$/.test(parsed.hostname) || parsed.hostname.includes(':')) return false;
  return hostnameAllowed(parsed.hostname);
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
          calendarUrl: String(p.calendarUrl || '').slice(0, 400),
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

    // CORS proxy for ICS, FMI, LIPAS, hel.fi, association HTML — not an open proxy.
    if (url.pathname === '/api/proxy/ics') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl || !isAllowedProxyTarget(targetUrl)) {
        return new Response(JSON.stringify({ error: 'Disallowed or missing URL parameter' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      let feedRes: Response;
      try {
        feedRes = await fetch(targetUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept: request.headers.get('Accept') || 'application/json,text/html,text/calendar,*/*',
            Referer: new URL(targetUrl).origin + '/'
          }
        });
      } catch {
        return new Response(JSON.stringify({ error: 'upstream_fetch_failed' }), {
          status: 502,
          headers: corsHeaders
        });
      }
      const body = await feedRes.text();
      const host = new URL(targetUrl).hostname.toLowerCase();
      const isPublicAssociation = isAssociationHost(host);
      const cacheControlHeader =
        feedRes.ok && isPublicAssociation
          ? 'public, s-maxage=300, stale-while-revalidate=600'
          : 'private, max-age=60';

      return new Response(body, {
        status: feedRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': feedRes.headers.get('Content-Type') || 'application/octet-stream',
          'Cache-Control': cacheControlHeader
        }
      });
    }

    return new Response(JSON.stringify({ status: 'Pelipäivä Edge API Active' }), {
      headers: corsHeaders
    });
  }
};
