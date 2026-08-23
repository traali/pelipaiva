/**
 * Pelipäivä PWA Compliance & Manifest Audit
 */
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');

console.log('🚀 [Pelipäivä PWA Audit] Auditing production build artifacts in /dist...');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Please run "npm run build" first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

// 1. Check index.html
const indexHtmlPath = path.join(distDir, 'index.html');
assert(fs.existsSync(indexHtmlPath), 'index.html entrypoint exists');

if (fs.existsSync(indexHtmlPath)) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(html.includes('manifest.webmanifest'), 'index.html links to Web App Manifest');
  assert(html.includes('viewport') && html.includes('width=device-width'), 'index.html contains responsive viewport meta tag');
  assert(html.includes('theme-color'), 'index.html contains theme-color meta tag');
}

// 2. Check Web App Manifest
const manifestPath = path.join(distDir, 'manifest.webmanifest');
assert(fs.existsSync(manifestPath), 'manifest.webmanifest exists');

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.name && manifest.name.includes('Pelipäivä'), `Manifest has app name: "${manifest.name}"`);
  assert(manifest.short_name, `Manifest has short_name: "${manifest.short_name}"`);
  assert(manifest.display === 'standalone', `Manifest display is standalone ("${manifest.display}")`);
  assert(manifest.start_url, `Manifest has start_url: "${manifest.start_url}"`);
  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, `Manifest defines ${manifest.icons?.length || 0} app icons`);
}

// 3. Check Service Worker
const swPath = path.join(distDir, 'sw.js');
assert(fs.existsSync(swPath), 'Service Worker (sw.js) generated');

const registerSwPath = path.join(distDir, 'registerSW.js');
assert(fs.existsSync(registerSwPath), 'Service Worker registration script exists');

console.log(`\n📋 PWA Audit Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
console.log('🎉 PWA manifest and service worker compliance 100% verified!\n');
