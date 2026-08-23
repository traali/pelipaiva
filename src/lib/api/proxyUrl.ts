/** Cloudflare Worker CORS proxy for FMI, LIPAS, association pages and calendar feeds. */
export const DEFAULT_PROXY_URL = 'https://pelipaiva-edge.sakkoja.workers.dev/api/proxy/ics';

export function proxiedUrl(targetUrl: string): string {
  return `${DEFAULT_PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
}
