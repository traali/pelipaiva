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
        name: 'FamDay - Family Sports & Schedule Hub',
        short_name: 'FamDay',
        description: 'Perheen pelipäivät, kuskiringit, koulu ja arjen hermokeskus',
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
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/ical.js')) {
            return 'vendor-calendar';
          }
          if (id.includes('node_modules/dexie')) {
            return 'vendor-db';
          }
          if (id.includes('node_modules/@turf') || id.includes('node_modules/fast-xml-parser')) {
            return 'vendor-geo';
          }
          if (id.includes('node_modules/tesseract.js')) {
            return 'vendor-ocr';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    port: 3000
  }
});
