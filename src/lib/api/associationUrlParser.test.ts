import { describe, expect, it } from 'vitest'
import { parseAssociationUrl, parseFinnishDateTime } from './associationUrlParser'
import { extractFixturesFromHtml } from './associationExtractor'

describe('parseAssociationUrl never invents a team or player', () => {
  it('a Torneopal player page names no team: parse fails', () => {
    expect(parseAssociationUrl('https://kwmemorialcup26.torneopal.fi/taso/pelaaja.php?pelaaja=146432')).toBeNull()
    expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/pelaaja.php?pelaaja=123')).toBeNull()
    expect(parseAssociationUrl('https://taso.torneopal.fi/pelaaja/146432')).toBeNull()
  })

  it('no sample name or fixed team leaks out of any player-page variant', () => {
    for (const url of [
      'https://kwmemorialcup26.torneopal.fi/taso/pelaaja.php?pelaaja=146432',
      'https://kwmemorialcup26.torneopal.fi/player/146432',
    ]) {
      const parsed = parseAssociationUrl(url)
      expect(parsed?.teamId).not.toBe('34013')
      expect(parsed?.playerName).toBeUndefined()
    }
  })

  it('an Espoo Liikkuu match URL names no team: parse fails', () => {
    expect(parseAssociationUrl('https://espooliikkuutournament.fi/match/1010355')).toBeNull()
  })

  it('team pages keep the team from the URL', () => {
    expect(
      parseAssociationUrl('https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&sarja=2546')
    ).toMatchObject({ association: 'torneopal', teamId: '34013', subdomain: 'kwmemorialcup26' })
    expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=30200')?.teamId).toBe('30200')
    expect(parseAssociationUrl('https://espooliikkuutournament.fi/team/203621')?.teamId).toBe('203621')
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/60341')?.teamId).toBe('60341')
  })
})

describe('parseFinnishDateTime never guesses a kickoff', () => {
  it('parses real date and time (Helsinki offset)', () => {
    expect(parseFinnishDateTime('la 24.05.2026', '15:00')).toBe('2026-05-24T15:00:00+03:00')
    expect(parseFinnishDateTime('15.01.2026', 'klo 18.30')).toBe('2026-01-15T18:30:00+02:00')
    expect(parseFinnishDateTime('ti 13.10.2026 klo 17.45')).toBe('2026-10-13T17:45:00+03:00')
  })

  it('missing time is not noon or 15:00', () => {
    expect(parseFinnishDateTime('24.05.2026', '')).toBeNull()
    expect(parseFinnishDateTime('24.05.2026')).toBeNull()
  })

  it('invalid date is not clamped or today', () => {
    expect(parseFinnishDateTime('32.13.2026', '15:00')).toBeNull()
    expect(parseFinnishDateTime('31.02.2026', '15:00')).toBeNull()
    expect(parseFinnishDateTime('huomenna', '15:00')).toBeNull()
    expect(parseFinnishDateTime('24.05.2026', '25:00')).toBeNull()
  })
})

describe('rows without a real date/time give no event (no 1970 game)', () => {
  it('extractFixturesFromHtml skips the row', () => {
    const parsed = parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=30200')!
    const html = `<table>
      <tr class="fixture-row" data-match-id="111"><td>la 24.05.2026</td><td>15:00</td><td>A</td><td>-</td><td>B</td><td>Halli 1</td></tr>
      <tr class="fixture-row" data-match-id="112"><td>la 31.05.2026</td><td></td><td>A</td><td>-</td><td>C</td><td>Halli 1</td></tr>
      <tr class="fixture-row" data-match-id="113"><td>ilmoitetaan</td><td>12:00</td><td>A</td><td>-</td><td>D</td><td>Halli 1</td></tr>
    </table>`
    const fixtures = extractFixturesFromHtml(html, parsed)
    expect(fixtures.map((f) => f.matchId)).toEqual(['111'])
    expect(fixtures.every((f) => !f.startTime.startsWith('1970'))).toBe(true)
  })
})
