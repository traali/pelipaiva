import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const out = {}
for (const id of ['816600', '816603']) {
  await p.goto(`https://volleyball-stats-7xq.pages.dev/match/${id}?v=${Date.now()}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(9000)
  const t = await p.locator('body').innerText()
  out[id] = { sw: await p.evaluate(() => document.documentElement.scrollWidth),
    tactics: (await p.locator('[data-testid=in-game-tactics]').count()) ? (await p.locator('[data-testid=in-game-tactics]').innerText()).slice(0, 900) : null,
    rot: t.split('\n').filter((l) => /aloituskierto|korvaa|Kokoonpanoa ei|kokoonpanon pelaajat|Toteutunut/i.test(l)).slice(0, 8),
    ai: await p.locator('text=Paikallinen tekoäly').count() }
  await p.screenshot({ path: `/workspace/logs/vb-${id}-tactics.png`, fullPage: false })
  if (out[id].tactics) { await p.locator('[data-testid=in-game-tactics]').scrollIntoViewIfNeeded(); await p.screenshot({ path: `/workspace/logs/vb-${id}-tactics2.png` }) }
  const r = p.locator('[data-testid^=rotation-]').first()
  if (await r.count()) { await r.scrollIntoViewIfNeeded(); await p.screenshot({ path: `/workspace/logs/vb-${id}-startrot.png` }) }
}
console.log(JSON.stringify(out, null, 1)); await b.close()
