export interface Env {
  MATCHDAY_KV: KVNamespace;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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

    // 3. Privacy-Preserving Streaming CORS Proxy for .ics & FMI Feeds
    if (url.pathname === '/api/proxy/ics') {
      const targetUrl = url.searchParams.get('url');
      if (
        !targetUrl ||
        (!targetUrl.startsWith('https://nimenhuuto.com') &&
          !targetUrl.startsWith('https://myclub.fi') &&
          !targetUrl.startsWith('https://opendata.fmi.fi') &&
          !targetUrl.startsWith('https://'))
      ) {
        return new Response(JSON.stringify({ error: 'Disallowed or missing URL parameter' }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const feedRes = await fetch(targetUrl);
      const icsText = await feedRes.text();
      return new Response(icsText, {
        headers: {
          ...corsHeaders,
          'Content-Type': feedRes.headers.get('Content-Type') || 'text/calendar; charset=utf-8',
          'Cache-Control': 'no-store' // 100% Privacy: zero edge caching of private feeds
        }
      });
    }

    return new Response(JSON.stringify({ status: 'Pelipäivä Edge API Active' }), {
      headers: corsHeaders
    });
  }
};
