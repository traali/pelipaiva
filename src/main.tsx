import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

window.addEventListener('unhandledrejection', (e) => {
  console.error('[PELIPAIVA:UNHANDLED]', e.reason);
});

// Foreground and periodic PWA update check
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    });
    // Check for new version every 30 minutes
    setInterval(() => {
      registration.update().catch(() => {});
    }, 30 * 60 * 1000);
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
