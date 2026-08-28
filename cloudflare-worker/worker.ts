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
  if (h === 'jopox.fi' || h.endsWith('.jopox.fi')) return true;
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

    // Origin-scoped CORS (M-12): echo only known first-party origins. The
    // proxy is consumed same-origin by the PWA; non-browser callers are
    // unaffected by CORS either way.
    const allowedOrigins = new Set([
      'https://pelipaiva.pages.dev',
      'https://pelipaiva.fi',
      'https://www.pelipaiva.fi',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ]);
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, If-Match, X-Pelipaiva-Rev',
      'Content-Type': 'application/json'
    };
    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
      corsHeaders['Access-Control-Allow-Origin'] = requestOrigin;
      corsHeaders['Vary'] = 'Origin';
    }

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

        let data: FamilyRosterV1;
        try {
          data = JSON.parse(dataStr) as FamilyRosterV1;
        } catch {
          return new Response(JSON.stringify({ error: 'corrupt_data' }), {
            status: 500,
            headers: corsHeaders
          });
        }
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

        // Validate profile entries (V42)
        for (const p of body.profiles) {
          if (p === null || p === undefined) {
            return new Response(JSON.stringify({ error: 'null_profile_entry' }), { status: 400, headers: corsHeaders });
          }
          if (p.colorHex && !/^#[0-9a-fA-F]{6}$/.test(p.colorHex)) {
            p.colorHex = '#3b82f6'; // sanitize to default
          }
        }

        const existingStr = await env.MATCHDAY_KV.get(kvKey);
        let currentRev = 0;
        if (existingStr) {
          let existing: FamilyRosterV1 | null = null;
          try {
            existing = JSON.parse(existingStr) as FamilyRosterV1;
          } catch {
            // Corrupted existing data — allow overwrite with rev 1
          }
          if (existing) {
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

      // DELETE /api/family/:code — destructive, so require the same
      // optimistic-concurrency proof as PUT when the slot has live data (M-12).
      if (request.method === 'DELETE') {
        const existingStr = await env.MATCHDAY_KV.get(kvKey);
        if (existingStr) {
          let currentRev = 0;
          try {
            currentRev = (JSON.parse(existingStr) as FamilyRosterV1).rev || 0;
          } catch {
            currentRev = 0;
          }
          const ifMatch =
            request.headers.get('If-Match')?.replace(/"/g, '') ||
            request.headers.get('X-Pelipaiva-Rev');
          if (!ifMatch || parseInt(ifMatch, 10) !== currentRev) {
            return new Response(JSON.stringify({ error: 'rev_conflict', currentRev }), {
              status: 409,
              headers: corsHeaders
            });
          }
        }
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

    // -------------------------------------------------------------
    // LIVE RFC 5545 iCALENDAR FEED: /api/calendar/feed/:code or /api/calendar?perhe=:code
    // -------------------------------------------------------------
    if (url.pathname.startsWith('/api/calendar/feed/') || (url.pathname === '/api/calendar' && url.searchParams.has('perhe'))) {
      if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: corsHeaders
        });
      }

      let rawCode = url.pathname.startsWith('/api/calendar/feed/')
        ? url.pathname.replace('/api/calendar/feed/', '')
        : url.searchParams.get('perhe') || '';

      const cleanCode = rawCode.trim().toUpperCase();
      const familyCode = cleanCode.includes('-')
        ? cleanCode
        : cleanCode.length === 6
        ? `${cleanCode.slice(0, 5)}-${cleanCode.slice(5)}`
        : cleanCode;

      const codeRegex = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$/;
      if (!codeRegex.test(familyCode)) {
        return new Response(JSON.stringify({ error: 'invalid_family_code' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // Read family roster from KV
      const kvKey = `fam_roster_${familyCode}`;
      const existingStr = await env.MATCHDAY_KV.get(kvKey);
      let roster: FamilyRosterV1 | null = null;
      if (existingStr) {
        try {
          roster = JSON.parse(existingStr) as FamilyRosterV1;
        } catch {
          roster = null;
        }
      }

      // Read customized family events / notes from KV
      const eventsKey = `fam_events_${familyCode}`;
      const existingEventsStr = await env.MATCHDAY_KV.get(eventsKey);
      let customEvents: any[] = [];
      if (existingEventsStr) {
        try {
          customEvents = JSON.parse(existingEventsStr) || [];
        } catch {
          customEvents = [];
        }
      }

      const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//FamDay//FamDay Family Calendar 1.0//FI',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:FamDay (${familyCode})`,
        'X-WR-TIMEZONE:Europe/Helsinki',
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H'
      ];

      // Format custom events into iCalendar VEVENT blocks
      for (const ev of customEvents) {
        if (!ev.startTime || !ev.title) continue;
        const uid = `famday-${ev.id || Math.random().toString(36).slice(2)}@famday.app`;
        const startUtc = new Date(ev.startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        let endUtc = ev.endTime
          ? new Date(ev.endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
          : new Date(new Date(ev.startTime).getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const descLines: string[] = [];
        if (ev.isTraining) descLines.push('🏃 HARJOITUKSET');
        if (ev.eventType === 'school') descLines.push('📚 KOULU / WILMA');
        if (ev.notes) descLines.push(`📝 Huomiot & Kyydit: ${ev.notes}`);
        if (ev.volunteerDuty) descLines.push(`☕ Talkoovuoro: ${ev.volunteerDuty}`);
        if (ev.kitAdvice) descLines.push(`👕 Peliasu: ${ev.kitAdvice.primaryJerseyColor || ''}`);
        descLines.push(`FamDay: https://pelipaiva.pages.dev/?perhe=${familyCode}`);

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${nowUtc}`);
        lines.push(`DTSTART:${startUtc}`);
        lines.push(`DTEND:${endUtc}`);
        lines.push(`SUMMARY:${(ev.title || 'Tapahtuma').replace(/,/g, '\\,')}`);
        if (ev.venue?.name) lines.push(`LOCATION:${(ev.venue.name).replace(/,/g, '\\,')}`);
        lines.push(`DESCRIPTION:${descLines.join('\\n')}`);
        lines.push('STATUS:CONFIRMED');
        lines.push('END:VEVENT');
      }

      lines.push('END:VCALENDAR');
      const icsContent = lines.join('\r\n');

      return new Response(icsContent, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `inline; filename="famday-${familyCode}.ics"`,
          'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360'
        }
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
