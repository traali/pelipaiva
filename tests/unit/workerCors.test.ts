import { describe, it, expect } from 'vitest';
import worker from '../../cloudflare-worker/worker';

type WorkerEnv = Parameters<typeof worker.fetch>[1];
const env = {} as WorkerEnv;

async function preflight(origin: string, path = '/api/fudis/syyskauden-paattajaiset-2026') {
  const res = await worker.fetch(
    new Request(`https://pelipaiva-edge.sakkoja.workers.dev${path}`, { method: 'OPTIONS', headers: { Origin: origin } }),
    env
  );
  return res.headers.get('Access-Control-Allow-Origin');
}

describe('pelipaiva-edge CORS allowlist', () => {
  it('lets the GitHub Pages copy of football-stats read fudisturnaus tournaments', async () => {
    expect(await preflight('https://traali.github.io')).toBe('https://traali.github.io');
  });

  it('keeps the existing first-party origins', async () => {
    expect(await preflight('https://pelipaiva.pages.dev')).toBe('https://pelipaiva.pages.dev');
    expect(await preflight('https://football-stats-agk.pages.dev')).toBe('https://football-stats-agk.pages.dev');
  });

  it('does not echo other github.io sites or random origins', async () => {
    expect(await preflight('https://evil.github.io')).toBeNull();
    expect(await preflight('https://traali.github.io.evil.example')).toBeNull();
  });
});
