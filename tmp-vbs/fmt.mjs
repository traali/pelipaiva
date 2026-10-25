import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/usr/bin/google-chrome'}); const p = await b.newPage({ viewport:{width:390,height:844} });
await p.goto('https://volleyball-stats-7xq.pages.dev/#/match/803471'); await p.waitForTimeout(6000);
const t=(await p.locator('main').innerText()).replace(/\n+/g,' | '); console.log(t.slice(0,600));
await b.close();
