import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage()
const seen = {}
p.on('response', async (r) => { const u = r.url(); const m = u.match(/(getPlayer|getGroup)\b/); if (!m || seen[m[1]]) return
  try { const j = await r.json(); seen[m[1]] = 1
    if (m[1] === 'getGroup') console.log('GROUP PS', JSON.stringify(j.group?.player_statistics?.[0]))
    else { const pl = j.player; console.log('PLAYER KEYS', Object.keys(pl).join(',')); for (const k of Object.keys(pl)) if (Array.isArray(pl[k]) && pl[k][0]) console.log('PL', k, pl[k].length, JSON.stringify(pl[k][0]).slice(0, 1200)) } } catch (e) { console.log('ERR', String(e)) } })
await p.goto('https://volleyball-stats-7xq.pages.dev/match/816600', { waitUntil: 'networkidle' }); await p.waitForTimeout(8000); await b.close()
