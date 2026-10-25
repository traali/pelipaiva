import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('https://volleyball-stats-7xq.pages.dev/#/match/816603', { waitUntil: 'networkidle' })
await p.waitForSelector('[data-testid=insights]', { timeout: 90000 }); await p.waitForTimeout(3000)
console.log(await p.$eval('[data-testid=insights]', e => e.innerText), 'sw', await p.evaluate(() => document.documentElement.scrollWidth))
await (await p.$('[data-testid=insights]')).screenshot({ path: '/workspace/logs/vb-816603-insights.png' })
await p.getByRole('button', { name: 'Jaa' }).click(); await p.waitForTimeout(800)
const t = await p.evaluate(() => document.body.innerText); const i = t.indexOf('Ennuste ja havainnot'); console.log('MD?', i >= 0, t.slice(i, i + 200))
await b.close()
