/**
 * Mock Fetch Helper for Pelipäivä E2E Test Suite
 * 
 * Intercepts HTTP requests to Finnish sports associations (Palloliitto,
 * Salibandyliitto, Basket.fi, Torneopal), LIPAS sports facility API,
 * FMI weather endpoints, and remote .ics calendar feeds.
 */

import { loadFixtureHtml, loadFixtureJson, loadFixtureIcs } from './fixtureLoader';

export type RouteHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;

export interface MockRoute {
  matcher: string | RegExp | ((url: string) => boolean);
  handler: RouteHandler;
  once?: boolean;
}

export interface CallRecord {
  url: string;
  init?: RequestInit;
  timestamp: number;
}

export class MockFetchManager {
  private _routes: MockRoute[] = [];
  private _history: CallRecord[] = [];
  private _originalFetch: typeof fetch | null = null;
  private _isInstalled = false;

  constructor() {
    this._registerDefaultRoutes();
  }

  private _registerDefaultRoutes() {
    // 1. Palloliitto Team Page
    this.addRoute(
      url => url.includes('tulospalvelu.palloliitto.fi') || (url.includes('palloliitto') && url.includes('team')),
      () => {
        const html = loadFixtureHtml('palloliitto_team_page');
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    );

    // 2. Salibandyliitto Team Page
    this.addRoute(
      url => url.includes('tulospalvelu.salibandy.fi') || (url.includes('salibandy') && url.includes('team')),
      () => {
        const html = loadFixtureHtml('salibandy_team_page');
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    );

    // 3. Basket.fi Team Page
    this.addRoute(
      url => url.includes('basket.fi') && (url.includes('joukkue') || url.includes('team_id')),
      () => {
        const html = loadFixtureHtml('basket_fi_team_page');
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    );

    // 4. Torneopal Team Page
    this.addRoute(
      url => url.includes('torneopal.fi') && url.includes('joukkue'),
      () => {
        const html = loadFixtureHtml('torneopal_taso_team_page');
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    );

    // 5. LIPAS Sports Facilities API
    this.addRoute(
      url => url.includes('lipas.cc.jyu.fi') || url.includes('sports-places'),
      () => {
        const json = loadFixtureJson('lipas_venues_sample');
        return new Response(JSON.stringify(json), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    );

    // 6. FMI Weather API / WFS
    this.addRoute(
      url => url.includes('opendata.fmi.fi') || url.includes('fmi.fi') || url.includes('weather'),
      () => {
        const json = loadFixtureJson('fmi_weather_sample');
        return new Response(JSON.stringify(json), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    );

    // 7. ICS Calendar feeds (Nimenhuuto, MyClub, Jopox, Torneopal)
    this.addRoute(
      url => url.includes('nimenhuuto.com') || (url.includes('.ics') && url.includes('hjk')),
      () => {
        const ics = loadFixtureIcs('nimenhuuto_hjk_multisquad');
        return new Response(ics, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar; charset=utf-8' }
        });
      }
    );

    this.addRoute(
      url => url.includes('myclub.fi') || (url.includes('.ics') && url.includes('ervi')),
      () => {
        const ics = loadFixtureIcs('myclub_ervi_talkoovahti');
        return new Response(ics, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar; charset=utf-8' }
        });
      }
    );

    this.addRoute(
      url => url.includes('jopox.fi') || (url.includes('.ics') && url.includes('honka')),
      () => {
        const ics = loadFixtureIcs('jopox_honka_warmup_kickoff');
        return new Response(ics, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar; charset=utf-8' }
        });
      }
    );

    this.addRoute(
      url => (url.includes('torneopal') && url.includes('.ics')) || url.includes('puma'),
      () => {
        const ics = loadFixtureIcs('torneopal_puma_volleyball');
        return new Response(ics, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar; charset=utf-8' }
        });
      }
    );
  }

  /**
   * Adds a route matcher and handler.
   */
  addRoute(
    matcher: string | RegExp | ((url: string) => boolean),
    handler: RouteHandler,
    once = false
  ): this {
    this._routes.unshift({ matcher, handler, once });
    return this;
  }

  /**
   * Convenience helper to mock a specific endpoint with static JSON, text, or status.
   */
  mockRoute(
    urlMatcher: string | RegExp | ((url: string) => boolean),
    body: string | object,
    status = 200,
    headers: Record<string, string> = {}
  ): this {
    const isObj = typeof body === 'object' && body !== null;
    const responseBody = isObj ? JSON.stringify(body) : String(body);
    const defaultHeaders = isObj
      ? { 'Content-Type': 'application/json', ...headers }
      : { 'Content-Type': 'text/plain; charset=utf-8', ...headers };

    return this.addRoute(urlMatcher, () => {
      return new Response(responseBody, {
        status,
        headers: defaultHeaders
      });
    });
  }

  /**
   * Convenience helper to mock a route once.
   */
  mockOnce(
    urlMatcher: string | RegExp | ((url: string) => boolean),
    body: string | object,
    status = 200,
    headers: Record<string, string> = {}
  ): this {
    const isObj = typeof body === 'object' && body !== null;
    const responseBody = isObj ? JSON.stringify(body) : String(body);
    const defaultHeaders = isObj
      ? { 'Content-Type': 'application/json', ...headers }
      : { 'Content-Type': 'text/plain; charset=utf-8', ...headers };

    return this.addRoute(
      urlMatcher,
      () => new Response(responseBody, { status, headers: defaultHeaders }),
      true
    );
  }

  /**
   * Handles incoming fetch invocation.
   */
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    this._history.push({ url: urlString, init, timestamp: Date.now() });

    for (let i = 0; i < this._routes.length; i++) {
      const route = this._routes[i];
      let matched = false;

      if (typeof route.matcher === 'string') {
        matched = urlString.includes(route.matcher);
      } else if (route.matcher instanceof RegExp) {
        matched = route.matcher.test(urlString);
      } else if (typeof route.matcher === 'function') {
        matched = route.matcher(urlString);
      }

      if (matched) {
        if (route.once) {
          this._routes.splice(i, 1);
        }
        return route.handler(urlString, init);
      }
    }

    // Default 404 Response if not matched
    return new Response(`[MockFetch] Unmatched route: ${urlString}`, {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'text/plain' }
    });
  };

  /**
   * Installs this mock fetch instance onto globalThis.fetch.
   */
  install(): this {
    if (!this._isInstalled) {
      this._originalFetch = globalThis.fetch;
      // @ts-ignore
      globalThis.fetch = this.fetch;
      this._isInstalled = true;
    }
    return this;
  }

  /**
   * Restores the original globalThis.fetch.
   */
  uninstall(): this {
    if (this._isInstalled && this._originalFetch) {
      globalThis.fetch = this._originalFetch;
      this._originalFetch = null;
      this._isInstalled = false;
    }
    return this;
  }

  /**
   * Resets all routes to the defaults and clears call history.
   */
  reset(): this {
    this._routes = [];
    this._history = [];
    this._registerDefaultRoutes();
    return this;
  }

  /**
   * Returns copy of recorded fetch calls.
   */
  getCallHistory(): CallRecord[] {
    return [...this._history];
  }

  /**
   * Clears recorded fetch calls history.
   */
  clearHistory(): this {
    this._history = [];
    return this;
  }
}

export const mockFetchManager = new MockFetchManager();

/**
 * Creates a standalone mock fetch function.
 */
export function createMockFetch(): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const manager = new MockFetchManager();
  return manager.fetch;
}

/**
 * Installs global mock fetch handler.
 */
export function installMockFetch(): MockFetchManager {
  return mockFetchManager.install();
}

/**
 * Restores global fetch handler.
 */
export function uninstallMockFetch(): void {
  mockFetchManager.uninstall();
}
