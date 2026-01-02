# TradieMate - Deploy Supabase Edge Function Secrets
# This script reads secrets from .env and deploys them to Supabase

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TradieMate - Deploying Supabase Secrets" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    exit 1
}

# Read .env file
Write-Host "Reading secrets from .env..." -ForegroundColor Yellow
$envContent = Get-Content .env

# Extract access token
$accessToken = ""
foreach ($line in $envContent) {
    if ($line -match '^SUPABASE_ACCESS_TOKEN=(.+)$') {
        $accessToken = $matches[1].Trim('"')
        break
    }
}

if ([string]::IsNullOrEmpty($accessToken)) {
    Write-Host "ERROR: SUPABASE_ACCESS_TOKEN not found in .env!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Access token found" -ForegroundColor Green
Write-Host ""

# Define secrets to deploy
$secrets = @(
    "RESEND_API_KEY",
    "EMAIL_FROM_DOMAIN",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "ENCRYPTION_KEY",
    "XERO_CLIENT_ID",
    "XERO_CLIENT_SECRET",
    "APP_URL",
    "REVENUECAT_WEBHOOK_SECRET"
)

Write-Host "Deploying secrets to Supabase..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0
$skippedCount = 0

foreach ($secretKey in $secrets) {
    # Find the secret value in .env
    $secretValue = ""
    foreach ($line in $envContent) {
        if ($line -match "^$secretKey=(.+)$") {
            $secretValue = $matches[1].Trim('"')
            break
        }
    }

    if ([string]::IsNullOrEmpty($secretValue)) {
        Write-Host "⚠️  Skipped: $secretKey (not found in .env)" -ForegroundColor Gray
        $skippedCount++
        continue
    }

    # Deploy the secret
    Write-Host "Deploying: $secretKey..." -ForegroundColor Cyan -NoNewline

    $env:SUPABASE_ACCESS_TOKEN = $accessToken
    $result = npx supabase secrets set "$secretKey=$secretValue" --project-ref rucuomtojzifrvplhwja 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅ Success" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host " ❌ Failed" -ForegroundColor Red
        Write-Host "   Error: $result" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Successful: $successCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor Red
Write-Host "⚠️  Skipped: $skippedCount" -ForegroundColor Gray
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "🎉 All secrets deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test PDF generation in your app" -ForegroundColor White
    Write-Host "2. Test email sending functionality" -ForegroundColor White
    Write-Host "3. Test SMS sending functionality" -ForegroundColor White
    Write-Host ""
    Write-Host "To verify deployed secrets, run:" -ForegroundColor Yellow
    Write-Host "  npx supabase secrets list --project-ref rucuomtojzifrvplhwja" -ForegroundColor White
} else {
    Write-Host "⚠️  Some secrets failed to deploy. Please review errors above." -ForegroundColor Yellow
}

Write-Host ""
