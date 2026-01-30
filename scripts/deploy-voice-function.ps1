# Check if logged in
Write-Host "Checking Supabase login status..."
$status = npx supabase projects list
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please login to Supabase first:" -ForegroundColor Yellow
    Write-Host "npx supabase login" -ForegroundColor Cyan
    exit 1
}

# Set secrets
Write-Host "Setting environment variables..."
$envFile = "supabase/functions/process-voice-command/.env"
if (Test-Path $envFile) {
    # Parse .env file
    $content = Get-Content $envFile
    foreach ($line in $content) {
        if ($line -match "^OPENROUTER_API_KEY=(.+)$") {
            $key = $matches[1]
            npx supabase secrets set OPENROUTER_API_KEY=$key
            Write-Host "Set OPENROUTER_API_KEY secret" -ForegroundColor Green
        }
    }
} else {
    Write-Host "No .env file found at $envFile. Skipping secrets setup." -ForegroundColor Yellow
    Write-Host "Please ensure OPENROUTER_API_KEY is set in Supabase secrets."
}

# Deploy function
Write-Host "Deploying process-voice-command function..."
npx supabase functions deploy process-voice-command --no-verify-jwt

Write-Host "Deployment complete!" -ForegroundColor Green
