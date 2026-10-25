import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
await p.goto('https://tulospalvelu.lentopallo.fi/match/816600', { waitUntil: 'networkidle' }); await p.waitForTimeout(4000)
await p.locator('text=Tilastot').first().click().catch(()=>{}); await p.waitForTimeout(3000)
const ths = await p.locator('th').allInnerTexts(); console.log('MATCH TH', JSON.stringify(ths.slice(0,60)))
const link = await p.locator('a[href*="/player/"]').first().getAttribute('href').catch(()=>null); console.log('PLINK', link)
if (link) { await p.goto(new URL(link, 'https://tulospalvelu.lentopallo.fi').href, { waitUntil: 'networkidle' }); await p.waitForTimeout(4000)
  console.log('PLAYER TH', JSON.stringify(await p.locator('th').allInnerTexts()))
  console.log((await p.locator('body').innerText()).slice(0, 2500)) }
await b.close()
