import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const out = {}
for (const id of ['816600', '816603']) {
  await p.goto(`https://volleyball-stats-7xq.pages.dev/match/${id}?v=${Date.now()}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(10000)
  const h2 = await p.locator('main h2').allInnerTexts()
  const t = await p.locator('body').innerText()
  out[id] = { sw: await p.evaluate(() => document.documentElement.scrollWidth), tabs: await p.locator('button:has-text("Kenttä")').count(), h2,
    rot: t.split('\n').filter((l) => /aloituskierto|korvaa|Kokoonpanoa ei|kokoonpanon pelaajat|Toteutunut/i.test(l)).slice(0, 8), ai: await p.locator('text=Paikallinen tekoäly:').count() }
  await p.screenshot({ path: `/workspace/logs/vb-${id}-onepage-full.png`, fullPage: true })
  await p.screenshot({ path: `/workspace/logs/vb-${id}-onepage-top.png` }); const k = p.locator("[data-testid=kohtaamisvertailu]"); out[id].mu = (await k.count()) ? (await k.innerText()).slice(0, 700) : null; if (out[id].mu) { await k.scrollIntoViewIfNeeded(); await p.screenshot({ path: `/workspace/logs/vb-${id}-kohtaamis.png` }) }
}
console.log(JSON.stringify(out, null, 1)); await b.close()
