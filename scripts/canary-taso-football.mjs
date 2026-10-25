#!/usr/bin/env node
/**
 * Live canary for Palloliitto TASO request signing (spl.torneopal.net).
 * Reads the salt and key straight from src/lib/api/torneopalClient.ts, signs
 * getMatch?match_id=4208631 and getTeam?team_id=185085 (PPJ/Laru sin), and
 * exits 1 loudly if Taso stops accepting the signature.
 *   node scripts/canary-taso-football.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/lib/api/torneopalClient.ts', import.meta.url), 'utf8')
const salt = src.match(/PALL_HASH_SALT = "([^"]+)"/)?.[1]
const key = src.match(/PALL_KEY = "([^"]+)"/)?.[1]
if (!salt || !key) { console.error('CANARY FAIL: salt/key not found in torneopalClient.ts'); process.exit(1) }

const BASE = 'https://spl.torneopal.net/taso/rest'
const headers = { Accept: `json/${key}`, Referer: 'https://tulospalvelu.palloliitto.fi/' }
const sign = (method, params) => {
  let input = `${method}?${salt}`
  for (const [k, v] of Object.entries(params)) input += `&${k}=${v}`
  return createHash('sha256').update(input).digest('hex')
}

async function call(method, params, signed) {
  const qs = new URLSearchParams(params)
  if (signed) qs.append('hash', sign(method, params))
  const res = await fetch(`${BASE}/${method}?${qs}`, { headers, signal: AbortSignal.timeout(15000) })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* empty 403 */ }
  return { status: res.status, ok: res.ok && String(json?.call?.status).toLowerCase() === 'ok', json }
}

let failed = false
for (const [method, params, check] of [
  ['getMatch', { match_id: '4208631' }, (j) => j?.match?.match_id === '4208631'],
  ['getTeam', { team_id: '185085' }, (j) => /Laru/.test(j?.team?.team_name || '')],
]) {
  const signed = await call(method, params, true)
  const unsigned = await call(method, params, false)
  const good = signed.ok && check(signed.json)
  console.log(`${good ? 'OK  ' : 'FAIL'} ${method} signed=${signed.status} unsigned=${unsigned.status}`)
  if (!good) failed = true
}
if (failed) {
  console.error('\nCANARY FAIL: spl.torneopal.net rejected Pelipäivä\'s signed request. The salt or key in')
  console.error('src/lib/api/torneopalClient.ts (PALL_HASH_SALT / PALL_KEY) has likely changed on tulospalvelu.palloliitto.fi.')
  process.exit(1)
}
console.log('Palloliitto TASO signature accepted.')
