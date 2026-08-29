/** Proxy live family ICS from the Worker so webcal://pelipaiva.pages.dev/api/calendar works. */
const WORKER = 'https://pelipaiva-edge.sakkoja.workers.dev';

export async function onRequestGet(context) {
  const incoming = new URL(context.request.url);
  const dest = new URL('/api/calendar', WORKER);
  dest.search = incoming.search;
  return fetch(dest.toString(), {
    method: 'GET',
    headers: {
      Accept: context.request.headers.get('Accept') || 'text/calendar,*/*',
      'User-Agent': context.request.headers.get('User-Agent') || 'FamDay-Pages-Calendar'
    }
  });
}
