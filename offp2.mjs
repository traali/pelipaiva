import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
await p.goto('https://tulospalvelu.lentopallo.fi/person/10614/info', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
await p.locator('text=PELAAJANA').first().click(); await p.waitForTimeout(4000)
console.log('URL', p.url(), 'TH', JSON.stringify(await p.locator('th').allInnerTexts()))
const t = await p.locator('body').innerText(); console.log(t.slice(t.indexOf('PELAAJANA'), t.indexOf('PELAAJANA') + 1500))
await p.locator('text=PELATUT').first().click(); await p.waitForTimeout(3000); console.log('PELATUT TH', JSON.stringify(await p.locator('th').allInnerTexts())); const tt = await p.locator('body').innerText(); console.log(tt.slice(tt.indexOf('PELATUT'), tt.indexOf('PELATUT')+500)); await p.screenshot({ path: '/workspace/logs/vb-official-player.png' })
await p.goto('https://tulospalvelu.lentopallo.fi/group/vb2026esuomi/M-alue/3', { waitUntil: 'networkidle' }).catch(()=>{}); await p.waitForTimeout(3000)
for (const tab of ['Pelaajat', 'PELAAJAT', 'Tilastot']) { const l = p.locator(`text=${tab}`).first(); if (await l.count()) { await l.click(); await p.waitForTimeout(3000); break } }
console.log('GROUP URL', p.url(), 'TH', JSON.stringify((await p.locator('th').allInnerTexts()).slice(0, 30)))
await b.close()
