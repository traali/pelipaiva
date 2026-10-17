import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:4173'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const results = []
const log = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`) }
const shots = process.env.SHOTS || '/workspace/pelipaiva/tmp-vbs'
async function step(name, fn) {
  try { await fn() } catch (e) { log(name, false, String(e).slice(0, 300)) }
}
const T = 60000

await step('version badge', async () => {
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' })
  const badge = await page.locator('[data-testid=app-version-badge]').innerText({ timeout: T })
  log('version badge', process.env.EXPECT ? badge.includes(process.env.EXPECT) : true, badge)
})

await step('team search', async () => {
  const q = process.env.TEAM_Q || 'PuMa U13'
  await page.goto(`${BASE}/#/search?q=${encodeURIComponent(q)}`)
  const sec = page.locator('[data-testid=search-teams]')
  const link = sec.locator('a[href*="/team/64154"]')
  await link.waitFor({ timeout: T })
  const n = await sec.locator('a[href*="/team/"]').count()
  const text = await link.innerText()
  await page.screenshot({ path: `${shots}/search-team.png`, fullPage: false })
  await link.click()
  await page.locator('h1', { hasText: 'PuMa/U13T2' }).waitFor({ timeout: T })
  const roster = await page.locator('a[href*="/player/"]').count()
  const games = await page.locator('a[href*="/match/"]').count()
  await page.screenshot({ path: `${shots}/team.png` })
  log('team search', n > 0, `q="${q}" ${n} team hits, first PuMa hit "${text.replace(/\n/g, ' / ')}", opened /team/64154 h1 PuMa/U13T2, roster links ${roster}, match links ${games}`)
  // favourite from team page
  const fav = page.locator('[data-testid=fav-toggle]').first()
  const before = await fav.getAttribute('aria-pressed')
  await fav.click()
  const after = await fav.getAttribute('aria-pressed')
  const stored = await page.evaluate(() => localStorage.getItem('volleyball.favorites.v1'))
  log('favourite team from team page', before === 'false' && after === 'true' && stored.includes('64154'), stored)
})

await step('player search', async () => {
  const q = process.env.PLAYER_Q || 'Anni Mäkeläinen'
  await page.goto(`${BASE}/#/search?q=${encodeURIComponent(q)}`)
  const sec = page.locator('[data-testid=search-players]')
  const link = sec.locator('a[href*="/player/56961"]')
  const t0 = Date.now()
  await link.waitFor({ timeout: T })
  const ms = Date.now() - t0
  const txt = await link.innerText()
  // favourite from search result
  await sec.locator('li').filter({ has: page.locator('a[href*="/player/56961"]') }).locator('[data-testid=fav-toggle]').click()
  const stored = await page.evaluate(() => localStorage.getItem('volleyball.favorites.v1'))
  await page.screenshot({ path: `${shots}/search-player.png` })
  await link.click()
  await page.locator('h1', { hasText: 'Anni Mäkeläinen' }).waitFor({ timeout: T })
  const teams = await page.locator('a[href*="/team/"]').allInnerTexts()
  const favOn = await page.locator('[data-testid=fav-toggle]').first().getAttribute('aria-pressed')
  log('player search', true, `q="${q}" hit "${txt.replace(/\n/g, ' / ')}" after ${ms} ms, opened /player/56961, teams: ${teams.join(', ')}`)
  log('favourite player from search result', stored.includes('56961') && favOn === 'true', stored)
})

await step('tournament', async () => {
  await page.goto(`${BASE}/#/browse`)
  await page.getByRole('button', { name: 'Turnaukset' }).click()
  const pc = page.locator('a[href*="/competition/power2026"]')
  await pc.waitFor({ timeout: T })
  await pc.click()
  const cat = page.locator('a[href$="/competition/power2026/category/PD"]')
  await cat.waitFor({ timeout: T })
  await cat.click()
  await page.locator('h1').waitFor()
  const days = page.locator('a[href*="/match/"]')
  await days.first().waitFor({ timeout: T })
  const nMatches = await days.count()
  const heads = await page.locator('h3').allInnerTexts()
  const first = await days.first().innerText()
  await page.screenshot({ path: `${shots}/tournament-days.png` })
  log('tournament day list', nMatches > 0, `power2026/PD ${nMatches} match links, days: ${heads.slice(0, 5).join(' | ')}; first row "${first.replace(/\n/g, ' / ')}"`)
  await page.getByRole('button', { name: 'Lohkot ja vaiheet' }).click()
  const stageHeads = await page.locator('h2').allInnerTexts()
  log('tournament stages', stageHeads.length > 0, stageHeads.join(' | '))
  const ko = page.locator('a[href*="/group/power2026/PD/"]', { hasText: '1-4' })
  if (await ko.count()) {
    await ko.first().click()
    await page.locator('h1', { hasText: '1-4' }).waitFor({ timeout: T })
    await page.locator('a[href*="/match/"]').first().waitFor({ timeout: T })
    const tables = await page.locator('table').count()
    const ms = await page.locator('a[href*="/match/"]').allInnerTexts()
    await page.screenshot({ path: `${shots}/knockout.png` })
    log('knockout shows matches, no table', tables === 0 && ms.length > 0, `${ms.length} games: ${ms.slice(0, 4).map((x) => x.replace(/\n/g, ' / ')).join(' || ')}`)
    await page.locator('a[href*="/match/"]').first().click()
    await page.locator('h1').waitFor()
    await page.getByText('Pelimuoto').waitFor({ timeout: T })
    const fmt = await page.getByText('Pelimuoto').innerText()
    const score = await page.locator('p.text-3xl').innerText().catch(() => '(no headline)')
    log('tournament match opens', true, `${await page.locator('h1').innerText()} ${score}; ${fmt}`)
  }
  await page.goto(`${BASE}/#/group/power2026/PD/1`)
  await page.locator('a[href*="/match/"]').first().waitFor({ timeout: T })
  const tbl = await page.locator('table').count()
  const hdr = await page.locator('thead').innerText().catch(() => '')
  await page.screenshot({ path: `${shots}/group-a.png`, fullPage: true })
  log('group stage shows TASO table', tbl === 1, hdr.replace(/\s+/g, ' '))
})

await step('youth tournament day U11 tie', async () => {
  await page.goto(`${BASE}/#/match/817095`)
  await page.locator('h1').waitFor({ timeout: T })
  await page.getByText('Pelimuoto').waitFor({ timeout: T })
  const score = await page.locator('p.text-3xl').innerText()
  const fmt = await page.getByText('Pelimuoto').innerText()
  log('U11 fixed 2-set tie', score.includes('1–1') && score.includes('tasapeli'), `${score.replace(/\n/g, ' ')} · ${fmt}`)
})

await step('match 803471', async () => {
  await page.goto(`${BASE}/#/match/803471`)
  const tab = page.getByRole('button', { name: /Pisteet \(\d+\)/ })
  await tab.waitFor({ timeout: T })
  const label = await tab.innerText()
  await page.screenshot({ path: `${shots}/match-803471.png` })
  log('match 803471 Pisteet (180)', label.includes('Pisteet (180)'), `${await page.locator('h1').innerText()} — ${label}`)
})

await browser.close()
const fails = results.filter((r) => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length ? 1 : 0)
