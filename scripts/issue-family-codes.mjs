#!/usr/bin/env node
/**
 * Print 10 Crockford-32 family slots to stdout.
 * Does not write files. Do not pipe this into the repo.
 *
 *   node scripts/issue-family-codes.mjs
 *   cd cloudflare-worker && npx wrangler secret put FAMILY_CODES
 */
const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const pick = () => A[Math.floor(Math.random() * A.length)];
const one = () => `${Array.from({ length: 5 }, pick).join('')}-${pick()}`;

const codes = new Set();
while (codes.size < 10) codes.add(one());
const list = [...codes];

process.stdout.write(`${list.join(',')}\n`);
process.stderr.write(
  [
    '',
    'Paste that single line as Cloudflare Worker secret FAMILY_CODES.',
    'Dashboard: Workers → pelipaiva-edge → Settings → Variables and Secrets',
    'CLI:       cd cloudflare-worker && npx wrangler secret put FAMILY_CODES',
    'Never commit this output. See docs/FAMILY_CODES_OPS.md',
    ''
  ].join('\n')
);
