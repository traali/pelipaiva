import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerPelipaivaWebMCP } from './lib/agents/webMcpRegistry';
import './index.css';

// Register WebMCP browser tools for AI agents
registerPelipaivaWebMCP().catch((err) => console.warn('[WebMCP] Boot failed', err));

window.addEventListener('unhandledrejection', (e) => {
  console.error('[PELIPAIVA:UNHANDLED]', e.reason);
});

// Foreground and periodic PWA update check
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // The new service worker activates at once (skipWaiting + clientsClaim), but
  // a page that is already open keeps running the old JavaScript until it is
  // reloaded. A phone PWA resumed from the background is never reloaded, so it
  // could keep an old version for days. When a new worker takes over a page
  // that already had one, reload once so the new version is what the family sees.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });

  navigator.serviceWorker.ready.then((registration) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch((err) => console.warn('[SW] Registration update failed:', err));
      }
    });
    // Check for new version every 30 minutes
    setInterval(() => {
      registration.update().catch((err) => console.warn('[SW] Registration update failed:', err));
    }, 30 * 60 * 1000);
  }).catch((err) => console.warn('[SW] ready failed:', err));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
