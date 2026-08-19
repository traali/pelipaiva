# Pelipäivä - Cloudflare Automated Deployment Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PELIPÄIVÄ - Cloudflare Deploy Pipeline" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Run Unit Tests
Write-Host "[1/4] Running automated tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed! Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host "All tests passed." -ForegroundColor Green

# 2. Build Production Frontend PWA
Write-Host "[2/4] Building production PWA bundle..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host "PWA built successfully." -ForegroundColor Green

# 3. Check Wrangler Authentication
Write-Host "[3/4] Verifying Cloudflare Wrangler login..." -ForegroundColor Yellow
$authCheck = npx wrangler whoami 2>&1 | Out-String
if ($authCheck -match "Not logged in" -or $authCheck -match "invalid_grant") {
    Write-Host "Not logged in to Cloudflare. Starting wrangler login..." -ForegroundColor Yellow
    npx wrangler login
}

# 4. Deploy Cloudflare Pages (Frontend)
Write-Host "[4/4] Deploying to Cloudflare Pages..." -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name pelipaiva --commit-dirty=true

# 5. Deploy Cloudflare Edge Worker
Write-Host "[5/5] Deploying Cloudflare Edge Worker..." -ForegroundColor Yellow
Push-Location cloudflare-worker
npx wrangler deploy
Pop-Location

Write-Host "========================================" -ForegroundColor Green
Write-Host "DEPLOYMENT FINISHED!" -ForegroundColor Green
Write-Host "PWA URL: https://pelipaiva.pages.dev" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
