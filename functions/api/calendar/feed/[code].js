const WORKER = 'https://pelipaiva-edge.sakkoja.workers.dev';

export async function onRequestGet(context) {
  const code = context.params?.code || '';
  const dest = new URL(`/api/calendar/feed/${encodeURIComponent(code)}`, WORKER);
  return fetch(dest.toString(), {
    method: 'GET',
    headers: {
      Accept: context.request.headers.get('Accept') || 'text/calendar,*/*',
      'User-Agent': context.request.headers.get('User-Agent') || 'FamDay-Pages-Calendar'
    }
  });
}
