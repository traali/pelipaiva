import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
await p.goto('https://tulospalvelu.lentopallo.fi/match/816600', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
await p.locator('text=Tilastot').first().click(); await p.waitForTimeout(3000)
for (const r of await p.locator('tr').allInnerTexts()) console.log(r.replace(/\s+/g, ' '))
await b.close()
