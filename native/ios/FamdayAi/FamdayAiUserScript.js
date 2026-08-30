/**
 * Injected into the WKWebView that hosts pelipaiva.pages.dev.
 * Safari does not get this file. It exposes window.FamdayNativeAi
 * on top of webkit.messageHandlers.famdayAi.
 */
(function () {
  if (window.FamdayNativeAi) return;
  if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.famdayAi) {
    return;
  }
  var pending = {};
  var seq = 0;
  window.__famdayAiResolve = function (id, ok, value) {
    var job = pending[id];
    if (!job) return;
    delete pending[id];
    if (ok) job.resolve(value);
    else job.reject(new Error(String(value || 'native_ai_error')));
  };
  function call(method, payload) {
    return new Promise(function (resolve, reject) {
      var id = 'js' + (++seq);
      pending[id] = { resolve: resolve, reject: reject };
      var body = Object.assign({ id: id, method: method }, payload || {});
      window.webkit.messageHandlers.famdayAi.postMessage(body);
    });
  }
  window.FamdayNativeAi = {
    availability: function () { return call('availability'); },
    engine: function () { return call('engine'); },
    prompt: function (system, user) { return call('prompt', { system: system, user: user }); },
    loadQwen: function () {
      return call('loadQwen').then(function (v) {
        return { ok: v === 'ok' || v === true, error: v === 'ok' ? undefined : String(v) };
      });
    },
    unload: function () { return call('unload').then(function () { return undefined; }); }
  };
})();
