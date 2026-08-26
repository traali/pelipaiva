import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pelipäivä - Matchday Hub',
        short_name: 'Pelipäivä',
        description: 'Suomalaisen junioriurheilun ottelupäivän tilannekeskus',
        theme_color: '#000000',
        background_color: '#000000',
        lang: 'fi',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Tesseract assets are runtime-fetched on demand (OCR tab), not
        // install-critical — precaching 14 MB would blow the budget (M-53).
        globIgnores: ['**/tesseract/**'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            'clsx',
            'tailwind-merge'
          ],
          'vendor-icons': ['lucide-react'],
          'vendor-motion': ['motion'],
          'vendor-calendar': ['ical.js'],
          'vendor-db': ['dexie', 'dexie-react-hooks'],
          'vendor-geo': ['@turf/distance', 'fast-xml-parser'],
          'vendor-xlsx': ['xlsx'],
          'vendor-ocr': ['tesseract.js']
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    port: 3000
  }
});
