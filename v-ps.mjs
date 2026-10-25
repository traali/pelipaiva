import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
for (const id of ['816600','816603']) {
  await p.goto(`https://volleyball-stats-7xq.pages.dev/match/${id}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(4000)
  const t = p.getByTestId('player-match-stats'); const n = await t.count()
  const sw = await p.evaluate(() => document.documentElement.scrollWidth)
  console.log(id, 'table', n, 'sw', sw, n ? (await t.first().innerText()).slice(0, 400).replace(/\n/g,' | ') : '')
  const hdr = await p.locator('th').allInnerTexts(); console.log(id, 'th', [...new Set(hdr)].join(','))
  if (n) { await t.first().scrollIntoViewIfNeeded(); await t.first().screenshot({ path: `/workspace/logs/vb-${id}-playerstats.png` }) }
}
await b.close()
