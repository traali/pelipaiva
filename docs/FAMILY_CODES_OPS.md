# Family codes — operator runbook

Public repo. **Never commit issued codes.** They are the only keys that may write `MATCHDAY_KV` family records.

Product: https://pelipaiva.pages.dev  
Worker: `pelipaiva-edge` (`https://pelipaiva-edge.sakkoja.workers.dev`)  
Binding: `MATCHDAY_KV`  
Secret name: `FAMILY_CODES`

---

## 0. What operators need to know

| Fact | Detail |
| --- | --- |
| Codes are optional for users | Pelipäivä works fully on one phone with no code (Dexie only). |
| Codes are not optional for the Worker | Empty or unknown code → **403** `unknown_family`. Fail closed. |
| Ten slots | Comma-separated Crockford-32 values in one secret. Max storage = 10 KV keys. |
| Possession = membership | Anyone with a live code can GET/PUT that family’s roster. |
| Client cannot mint | There is no “Luo perhe-koodi”. Join or `?perhe=`. |
| GitHub cannot mint | Alphabet and regex are public. The **issued list is not**. |

Format: `XXXXX-X`  
Alphabet: `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no I, L, O, U)  
Regex (client + Worker): `^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]$`

---

## 1. First-time setup (unlock family sync)

Until this secret exists, every `/api/family/:code` call is 403. Local PWA still works.

### Dashboard (preferred)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **pelipaiva-edge**
2. **Settings** → **Variables and Secrets**
3. **Add** → type **Secret**
4. Name: `FAMILY_CODES`
5. Value: ten codes, comma-separated, no spaces required:

```
XXXXX-1,XXXXX-2,XXXXX-3,XXXXX-4,XXXXX-5,XXXXX-6,XXXXX-7,XXXXX-8,XXXXX-9,XXXXX-A
```

6. Save. Takes effect **without a redeploy**.

### CLI (same result)

From a machine that is allowed to see the codes (not CI logs):

```bash
# generate 10 codes (prints to stdout only)
node scripts/issue-family-codes.mjs

# paste the csv when wrangler prompts (input is hidden)
cd cloudflare-worker
npx wrangler secret put FAMILY_CODES
```

Do **not** put `FAMILY_CODES` in `wrangler.jsonc` `vars` (that is public).  
Do **not** add it as a GitHub Actions secret unless the org accepts that extra copy.

CD (`.github/workflows/cd.yml`) deploys the Worker script only. It does **not** upload this secret.

---

## 2. Hand out a slot

Pick **one** issued code per family. WhatsApp the join template (app copies it after join):

```
Pelipäivä-perhe {CODE}
Avaa: https://pelipaiva.pages.dev/?perhe={CODE}

Etunimi ja joukkue-URL Cloudflareen 7 pv.
Ottelut tulospalvelusta. Ei sukunimeä, ei vammoja.
```

Phone B: open the link, or Perhejako → paste code → **Liity**.

Unused slots stay empty until first successful PUT (first parent to join that code).

---

## 3. Verify (safe, no real codes)

These must stay **403** after the secret is set (they are not issued):

```bash
curl -sS -o /dev/stderr -w '%{http_code}\n' \
  https://pelipaiva-edge.sakkoja.workers.dev/api/family/ZZZZZ-9
# 403 {"error":"unknown_family"}

curl -sS -o /dev/stderr -w '%{http_code}\n' \
  https://pelipaiva-edge.sakkoja.workers.dev/api/family/SAIMA-4
# 400 {"error":"invalid_code_format"}   # I is illegal
```

Issued code, never used:

```bash
curl -sS -o /dev/stderr -w '%{http_code}\n' \
  https://pelipaiva-edge.sakkoja.workers.dev/api/family/{ISSUED}
# 404 {"error":"not_found"}   # allowlisted, empty KV
```

Issued code after a parent joined:

```bash
# 200 + JSON roster, ETag rev
```

PUT of an unknown code must 403 even with a valid body.

---

## 4. Rotate / revoke

| Goal | Action |
| --- | --- |
| Kill one family | Remove that code from `FAMILY_CODES`, save secret. Optionally `DELETE /api/family/{code}` to drop KV. |
| Replace a leaked code | Generate a new Crockford value, edit the csv, save secret. Tell that family the new code. Old code → 403. |
| Kill all family writes | Delete the secret or set it empty. Everything 403. PWA stays local-first. |
| Add family 11 | Don’t. Ten is the cap. Revoke an unused slot and reuse. |

After a dashboard edit, wait a few seconds and re-run the curl checks.

---

## 5. Rate limits and concurrency (already in Worker)

| Method | Per IP / 15 min |
| --- | --- |
| GET | 20 |
| PUT | 5 |
| DELETE | 3 |

Existing KV row + missing/stale `If-Match` → **409**. First PUT of an empty allowlisted slot has no `If-Match`.

Roster TTL: **7 days** sliding on PUT. Idle family vanishes; same issued code can be used again (404 then first PUT).

---

## 6. What is allowed in git vs not

| In git | Never in git |
| --- | --- |
| Regex, alphabet, fail-closed Worker | The 10 live values |
| This runbook | Screenshots of the dashboard secret |
| `scripts/issue-family-codes.mjs` | CI logs that echo the csv |
| Tests with fake csv `AAAAA-1,BBBBB-2` | `wrangler.jsonc` `vars.FAMILY_CODES` |

If a code appears in a PR, treat it as leaked: rotate.

---

## 7. User-facing behaviour (for support)

- Opening pelipaiva.pages.dev with no `?perhe=` → normal local app.
- Wrong format → client “Virheellinen koodin muoto”.
- Unknown issued list → Worker 403 → “Koodi ei ole voimassa”.
- Valid empty slot → first join creates the KV row.
- Two phones, same issued code → same roster; hydrate from tulospalvelu per phone.

Related: [FAMILY_SYNC_FINAL.md](./FAMILY_SYNC_FINAL.md)
