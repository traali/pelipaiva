import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
for (const u of ['https://tulospalvelu.lentopallo.fi/person/10614/info','https://tulospalvelu.lentopallo.fi/person/10614/stats']) {
await p.goto(u, { waitUntil: 'networkidle' }); await p.waitForTimeout(4000)
console.log('URL', u, 'TH', JSON.stringify(await p.locator('th').allInnerTexts()))
console.log((await p.locator('body').innerText()).slice(0, 1800)) }
await p.screenshot({ path: '/workspace/logs/vb-official-player.png', fullPage: true }); await b.close()
