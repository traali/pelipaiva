<#
.SYNOPSIS
    Pelipäivä - Cloudflare Automated Deployment Script (Pages & Edge Worker)
.DESCRIPTION
    Runs tests, builds the PWA bundle, and deploys both Cloudflare Pages and the Cloudflare Edge Worker.
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "⚽ PELIPÄIVÄ — Cloudflare Deploy Pipeline" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Run Unit Tests
Write-Host "`n[1/4] Running automated tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests failed! Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host "✅ All tests passed." -ForegroundColor Green

# 2. Build Production Frontend PWA
Write-Host "`n[2/4] Building production PWA bundle..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host "✅ PWA built successfully." -ForegroundColor Green

# 3. Check Wrangler Authentication
Write-Host "`n[3/4] Verifying Cloudflare Wrangler login..." -ForegroundColor Yellow
$authCheck = npx wrangler whoami 2>&1
if ($authCheck -match "Not logged in" -or $authCheck -match "invalid_grant") {
    Write-Host "⚠️ Not logged in to Cloudflare. Opening browser login..." -ForegroundColor Yellow
    npx wrangler login
}

# 4. Deploy Cloudflare Pages (Frontend)
Write-Host "`n[4/4] Deploying to Cloudflare Pages..." -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name pelipaiva --commit-dirty=true
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Pages deploy note. If project doesn't exist yet, it will be initialized." -ForegroundColor Yellow
}

# 5. Deploy Cloudflare Edge Worker
Write-Host "`n[5/5] Deploying Cloudflare Edge Worker (Proxy & KV)..." -ForegroundColor Yellow
Push-Location cloudflare-worker
npx wrangler deploy
Pop-Location

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "🌐 PWA URL: https://pelipaiva.pages.dev" -ForegroundColor Cyan
Write-Host "⚡ Edge Worker: https://pelipaiva-edge.<your-subdomain>.workers.dev" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
