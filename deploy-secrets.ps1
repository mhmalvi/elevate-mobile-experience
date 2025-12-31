# Deploy all secrets to Supabase Edge Functions
# This ensures all functions have access to required API keys

$PROJECT_REF = "rucuomtojzifrvplhwja"

Write-Host "🚀 Deploying secrets to Supabase Edge Functions..." -ForegroundColor Cyan
Write-Host ""

# Helper function to extract env variable value
function Get-EnvValue {
    param($VarName)
    $line = Get-Content .env | Where-Object { $_ -match "^$VarName=" }
    if ($line) {
        return $line -replace "^$VarName=", '' -replace '"', ''
    }
    return $null
}

# Deploy all secrets
$secrets = @{
    "ENCRYPTION_KEY" = Get-EnvValue "ENCRYPTION_KEY"
    "RESEND_API_KEY" = Get-EnvValue "RESEND_API_KEY"
    "STRIPE_SECRET_KEY" = Get-EnvValue "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET" = Get-EnvValue "STRIPE_WEBHOOK_SECRET"
    "TWILIO_ACCOUNT_SID" = Get-EnvValue "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN" = Get-EnvValue "TWILIO_AUTH_TOKEN"
    "TWILIO_PHONE_NUMBER" = Get-EnvValue "TWILIO_PHONE_NUMBER"
    "XERO_CLIENT_ID" = Get-EnvValue "XERO_CLIENT_ID"
    "XERO_CLIENT_SECRET" = Get-EnvValue "XERO_CLIENT_SECRET"
    "XERO_REDIRECT_URI" = Get-EnvValue "XERO_REDIRECT_URI"
    "APP_URL" = Get-EnvValue "APP_URL"
    "REVENUECAT_WEBHOOK_SECRET" = Get-EnvValue "REVENUECAT_WEBHOOK_SECRET"
}

foreach ($key in $secrets.Keys) {
    $value = $secrets[$key]
    if ($value) {
        Write-Host "Setting $key..." -ForegroundColor Yellow
        npx supabase secrets set "$key=$value" --project-ref $PROJECT_REF
    } else {
        Write-Host "⚠️  Skipping $key (not found in .env)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ All secrets deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Redeploying critical Edge Functions with new secrets..." -ForegroundColor Cyan
Write-Host ""

# Redeploy critical functions to pick up new secrets
$functions = @(
    "send-email",
    "send-notification",
    "send-team-invitation",
    "create-payment",
    "xero-oauth",
    "xero-sync-invoices",
    "xero-sync-clients",
    "generate-pdf"
)

foreach ($func in $functions) {
    Write-Host "Deploying $func..." -ForegroundColor Yellow
    npx supabase functions deploy $func --project-ref $PROJECT_REF
}

Write-Host ""
Write-Host "✅ Deployment complete! All features should now be functional." -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Next step: Test the features in your app" -ForegroundColor Cyan
