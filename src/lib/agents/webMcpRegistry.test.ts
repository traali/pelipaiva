import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PelipaivaDB } from '../storage/db'
import type { MatchdayEvent, PlayerProfile } from '../../types/matchday'
import {
  buildPelipaivaTools,
  getModelContext,
  registerPelipaivaWebMCP,
  unregisterPelipaivaWebMCP,
  type WebMcpTool,
} from './webMcpRegistry'

type Registered = { tool: WebMcpTool; signal?: AbortSignal }

function mockModelContext() {
  const registered: Registered[] = []
  return {
    registered,
    registerTool: vi.fn(async (tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
      registered.push({ tool, signal: options?.signal })
    }),
  }
}

const profile: PlayerProfile = {
  id: 'p1',
  playerName: 'Aino',
  teamName: 'PPJ P13',
  sport: 'football',
  primaryColor: 'sininen',
  calendarUrl: '',
  colorHex: '#123456',
  associationUrl: 'https://tulospalvelu.palloliitto.fi/team/60341',
}

function event(over: Partial<MatchdayEvent>): MatchdayEvent {
  return {
    id: 'e1',
    profileId: 'p1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'PPJ/Laru sin vs Kasiysi/PEP YJ2',
    homeTeam: 'PPJ/Laru sin',
    awayTeam: 'Kasiysi/PEP YJ2',
    isHomeMatch: true,
    startTime: '2026-10-08T15:00:00.000Z',
    endTime: '2026-10-08T16:30:00.000Z',
    warmupTime: '2026-10-08T14:15:00.000Z',
    warmupIsEstimate: true,
    venue: {
      name: 'Lauttasaari TN B',
      normalizedName: 'lauttasaari tn b',
      coordinates: { lat: 60.15, lng: 24.88 },
      isIndoor: false,
      surface: 'artificial_turf',
      hasFloodlights: true,
    },
    ...over,
  } as MatchdayEvent
}

describe('getModelContext', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is null without WebMCP (node, older browsers)', () => {
    expect(getModelContext()).toBeNull()
  })

  it('uses document.modelContext', () => {
    const mc = mockModelContext()
    vi.stubGlobal('document', { modelContext: mc })
    expect(getModelContext()).toBe(mc)
  })

  it('falls back to navigator.modelContext only when it exists', () => {
    const mc = mockModelContext()
    vi.stubGlobal('document', {})
    vi.stubGlobal('navigator', { modelContext: mc })
    expect(getModelContext()).toBe(mc)
  })

  it('ignores objects without registerTool', () => {
    vi.stubGlobal('document', { modelContext: {} })
    expect(getModelContext()).toBeNull()
  })
})

describe('registerPelipaivaWebMCP', () => {
  let testDb: PelipaivaDB

  beforeEach(() => {
    testDb = new PelipaivaDB(`webmcp-${Math.random().toString(36).slice(2)}`)
  })

  afterEach(async () => {
    unregisterPelipaivaWebMCP()
    vi.unstubAllGlobals()
    await testDb.delete()
  })

  it('does nothing and installs no globals when WebMCP is missing', async () => {
    const doc: Record<string, unknown> = {}
    const win: Record<string, unknown> = {}
    vi.stubGlobal('document', doc)
    vi.stubGlobal('window', win)
    expect(await registerPelipaivaWebMCP(testDb)).toBeNull()
    expect(doc.modelContext).toBeUndefined()
    expect(win.modelContext).toBeUndefined()
  })

  it('registers read-only tools with an AbortSignal and unregisters by aborting', async () => {
    const mc = mockModelContext()
    const doc = { modelContext: mc }
    vi.stubGlobal('document', doc)

    const controller = await registerPelipaivaWebMCP(testDb)
    expect(controller).toBeInstanceOf(AbortController)
    expect(doc.modelContext).toBe(mc) // host object untouched
    expect(mc.registered.map((r) => r.tool.name)).toEqual(['get_matchday_schedule', 'get_family_profiles'])
    for (const r of mc.registered) {
      expect(r.tool.annotations?.readOnlyHint).toBe(true)
      expect(r.signal).toBe(controller!.signal)
      expect(r.signal?.aborted).toBe(false)
    }

    unregisterPelipaivaWebMCP()
    expect(mc.registered.every((r) => r.signal?.aborted)).toBe(true)
  })

  it('no longer offers the made-up parking risk tool', () => {
    expect(buildPelipaivaTools(testDb).map((t) => t.name)).not.toContain('check_parking_risk')
  })

  it('a second boot replaces the first registration', async () => {
    const mc = mockModelContext()
    vi.stubGlobal('document', { modelContext: mc })
    const first = await registerPelipaivaWebMCP(testDb)
    const second = await registerPelipaivaWebMCP(testDb)
    expect(first!.signal.aborted).toBe(true)
    expect(second!.signal.aborted).toBe(false)
  })
})

describe('WebMCP tool output', () => {
  let testDb: PelipaivaDB

  beforeEach(async () => {
    testDb = new PelipaivaDB(`webmcp-out-${Math.random().toString(36).slice(2)}`)
    await testDb.profiles.put(profile)
  })

  afterEach(async () => {
    await testDb.delete()
  })

  const tool = (name: string) => buildPelipaivaTools(testDb).find((t) => t.name === name)!
  const parse = (r: { content: Array<{ type: string; text: string }> }) => {
    expect(r.content).toHaveLength(1)
    expect(r.content[0]!.type).toBe('text')
    return JSON.parse(r.content[0]!.text)
  }

  it('schedule returns stored data in spec-shaped content, nulls for unknowns', async () => {
    await testDb.events.bulkPut([
      event({ id: 'fixture-p1-palloliitto_60341_4208643', officialFixtureId: 'palloliitto_60341_4208643' }),
      event({
        id: 'ics-1',
        title: 'Treeni',
        eventType: 'training',
        isTraining: true,
        homeTeam: '',
        awayTeam: '',
        startTime: '2026-10-08T14:00:00.000Z',
        warmupIsEstimate: false,
        venue: { ...event({}).venue, name: '' },
      }),
      event({ id: 'other-day', startTime: '2026-10-09T15:00:00.000Z' }),
      event({ id: 'hidden', isHidden: true }),
    ])

    const out = parse(await tool('get_matchday_schedule').execute({ date: '2026-10-08' }))
    expect(out.date).toBe('2026-10-08')
    expect(out.count).toBe(2)
    const [training, game] = out.events
    expect(training.id).toBe('ics-1')
    expect(training.venue).toBeNull() // not 'Kenttä'
    expect(training.attendance).toBeNull() // not assumed 'in'
    expect(training.fromFederation).toBe(false)
    expect(training.federationMatchUrl).toBeNull()
    expect(game.meetTimeIsAppDefault).toBe(true)
    expect(game.statsAppUrl).toBe('https://football-stats-agk.pages.dev/#/match/4208643')
    expect(game.federationMatchUrl).toBe('https://tulospalvelu.palloliitto.fi/match/4208643')
    expect(game.score).toBeNull()
  })

  it('schedule filters by child and rejects a bad date', async () => {
    await testDb.events.put(event({ id: 'g1' }))
    expect(parse(await tool('get_matchday_schedule').execute({ date: '2026-10-08', playerName: 'ain' })).count).toBe(1)
    expect(parse(await tool('get_matchday_schedule').execute({ date: '2026-10-08', playerName: 'Ville' })).count).toBe(0)
    const bad = await tool('get_matchday_schedule').execute({ date: 'huomenna' })
    expect(bad.isError).toBe(true)
  })

  it('profiles lists stored profiles only', async () => {
    const out = parse(await tool('get_family_profiles').execute({}))
    expect(out).toEqual({
      count: 1,
      profiles: [{ id: 'p1', playerName: 'Aino', teamName: 'PPJ P13', sport: 'football' }],
    })
  })
})
