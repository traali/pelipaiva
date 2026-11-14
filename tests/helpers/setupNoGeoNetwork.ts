// Unit tests never wait on live geocoders (LIPAS, hel.fi ServiceMap, Photon):
// they behave as offline unless a test stubs fetch itself. Keeps the suite
// fast and deterministic when those services are slow.
const realFetch = globalThis.fetch;
const GEO_HOSTS = /^https:\/\/(api\.lipas\.fi|api\.hel\.fi\/servicemap|photon\.komoot\.io)/;

if (typeof realFetch === 'function') {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (GEO_HOSTS.test(url)) return Promise.reject(new TypeError('geocoder network disabled in unit tests'));
    return realFetch(input, init);
  }) as typeof fetch;
}
