import { describe, expect, it } from 'vitest'
import { federationMatchLinks, liveSatelliteUrl, parseOfficialFixtureId } from './federationLinks'

// Real TASO match ids, checked against the federation API and both sites.
describe('parseOfficialFixtureId', () => {
  it('reads torneopalClient ids', () => {
    expect(parseOfficialFixtureId('palloliitto_60341_4208643')).toEqual({
      association: 'palloliitto',
      teamId: '60341',
      matchId: '4208643',
    })
  })

  it('reads the fixture id inside an event id, even with a dashed profile id', () => {
    expect(parseOfficialFixtureId('fixture-p1-salibandy_25301_924881')?.matchId).toBe('924881')
    expect(parseOfficialFixtureId('fixture-a1b2-c3d4-basket_123_1010355')?.matchId).toBe('1010355')
  })

  it('rejects ids with no real match_id', () => {
    expect(parseOfficialFixtureId(undefined)).toBeNull()
    expect(parseOfficialFixtureId('')).toBeNull()
    // torneopalClient fallback when TASO sent no match_id
    expect(parseOfficialFixtureId('palloliitto_60341_2026-10-08')).toBeNull()
    // HTML table rows: match number (Nro) or row index, not match_id
    expect(parseOfficialFixtureId('palloliitto_60341_nro227')).toBeNull()
    expect(parseOfficialFixtureId('palloliitto_60341_row3')).toBeNull()
    expect(parseOfficialFixtureId('palloliitto_60341_m-1')).toBeNull()
    // cup seeds, ICS / MyClub / WhatsApp / manual ids
    expect(parseOfficialFixtureId('football-stats_60341_hc1')).toBeNull()
    expect(parseOfficialFixtureId('myclub-event-9577-44812@myclub.fi')).toBeNull()
    expect(parseOfficialFixtureId('me-device1-1700000000000')).toBeNull()
    expect(parseOfficialFixtureId('ics-1234567')).toBeNull()
  })
})

describe('federationMatchLinks', () => {
  it('football: Football Stats first, Palloliitto tulospalvelu second', () => {
    expect(federationMatchLinks({ officialFixtureId: 'palloliitto_60341_4208643', sport: 'football' })).toEqual({
      sport: 'football',
      matchId: '4208643',
      appUrl: 'https://football-stats-agk.pages.dev/#/match/4208643',
      appName: 'Football Stats',
      federationUrl: 'https://tulospalvelu.palloliitto.fi/match/4208643',
    })
  })

  it('floorball and basketball map by association', () => {
    const fb = federationMatchLinks({ officialFixtureId: 'salibandy_25301_924881', sport: 'floorball' })
    expect(fb?.appUrl).toBe('https://floorball-stats.pages.dev/#/match/924881')
    expect(fb?.federationUrl).toBe('https://tulospalvelu.salibandy.fi/match/924881')
    const bb = federationMatchLinks({ officialFixtureId: 'basket_5001_1010355', sport: 'basketball' })
    expect(bb?.appUrl).toBe('https://basketball-stats-byu.pages.dev/#/match/1010355')
    expect(bb?.federationUrl).toBe('https://tulospalvelu.basket.fi/match/1010355')
  })

  it('never uses the dead or foreign short hosts', () => {
    const all = [
      federationMatchLinks({ officialFixtureId: 'palloliitto_1_4208643' }),
      federationMatchLinks({ officialFixtureId: 'basket_1_1010355' }),
      federationMatchLinks(
        { officialFixtureId: 'torneopal_30200_753791', sport: 'volleyball' },
        { associationUrl: 'https://tulospalvelu.lentopallo.fi/team/30200' }
      ),
    ]
    for (const l of all) {
      expect(l?.appUrl).not.toMatch(/\/\/(football|basketball|volleyball)-stats\.pages\.dev/)
    }
  })

  it('volleyball (association torneopal) links only with the matching team URL', () => {
    const ev = { officialFixtureId: 'torneopal_30200_753791', sport: 'volleyball' }
    expect(federationMatchLinks(ev)).toBeNull()
    expect(federationMatchLinks(ev, { associationUrl: 'https://tulospalvelu.lentopallo.fi/team/30200' })).toEqual({
      sport: 'volleyball',
      matchId: '753791',
      appUrl: 'https://volleyball-stats-7xq.pages.dev/#/match/753791',
      appName: 'Volleyball Stats',
      federationUrl: 'https://tulospalvelu.lentopallo.fi/match/753791',
    })
    expect(
      federationMatchLinks(ev, { associationUrl: 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=30200' })?.federationUrl
    ).toBe('https://tulospalvelu.lentopallo.fi/match/753791')
    // another team's URL
    expect(federationMatchLinks(ev, { associationUrl: 'https://tulospalvelu.lentopallo.fi/team/99999' })).toBeNull()
  })

  it('cup subdomains use the sport federation API, so their ids link', () => {
    // torneopalClient skips cup hosts and asks the federation API of the URL's sport
    // (kwmemorial -> floorball -> salibandy-api), so the id belongs to salibandy.fi.
    const l = federationMatchLinks(
      { officialFixtureId: 'torneopal_34013_924881', sport: 'floorball' },
      { associationUrl: 'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&sarja=2546' }
    )
    expect(l?.appUrl).toBe('https://floorball-stats.pages.dev/#/match/924881')
    expect(l?.federationUrl).toBe('https://tulospalvelu.salibandy.fi/match/924881')
  })

  it('player-page URLs carry no real team id: no link', () => {
    expect(
      federationMatchLinks(
        { officialFixtureId: 'torneopal_34013_924881', sport: 'floorball' },
        { associationUrl: 'https://kwmemorialcup26.torneopal.fi/taso/pelaaja.php?pelaaja=146432' }
      )
    ).toBeNull()
  })

  it('a non-cup Torneopal subdomain may have its own ids: no link', () => {
    expect(
      federationMatchLinks(
        { officialFixtureId: 'torneopal_777_123456', sport: 'football' },
        { associationUrl: 'https://seurakisa.torneopal.fi/taso/joukkue.php?joukkue=777' }
      )
    ).toBeNull()
  })

  it('no link for events without a TASO fixture', () => {
    expect(federationMatchLinks({ id: 'ics-abc', sport: 'football' })).toBeNull()
    expect(federationMatchLinks({ id: 'me-dev-1', sport: 'floorball' })).toBeNull()
    expect(federationMatchLinks({ id: 'wa-1', officialFixtureId: undefined, sport: 'football' })).toBeNull()
  })

  it('falls back to the fixture-… event id', () => {
    expect(federationMatchLinks({ id: 'fixture-p1-palloliitto_60341_4208643' })?.matchId).toBe('4208643')
  })
})

describe('liveSatelliteUrl', () => {
  it('opens the exact match with a hash route', () => {
    expect(liveSatelliteUrl('football', 'palloliitto_60341_4208643')).toBe(
      'https://football-stats-agk.pages.dev/#/match/4208643'
    )
    expect(liveSatelliteUrl('volleyball-stats', '753791', '', true)).toBe(
      'https://volleyball-stats-7xq.pages.dev/#/match/753791?embed=true'
    )
  })

  it('searches by team names when there is no match id', () => {
    expect(liveSatelliteUrl('floorball', '', 'Hawks Westend')).toBe(
      'https://floorball-stats.pages.dev/#/search?q=Hawks%20Westend'
    )
  })
})
