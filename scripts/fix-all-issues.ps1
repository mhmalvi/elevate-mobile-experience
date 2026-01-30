# Fix Database and Edge Function Issues

Write-Host "1. Deploying Database Migration to fix 'team_members' relationship error..." -ForegroundColor Cyan
npx supabase db push

Write-Host "2. Deploying Edge Functions with CORS fixes..." -ForegroundColor Cyan
npx supabase functions deploy check-stripe-account get-payment-settings xero-oauth

Write-Host "---------------------------------------------------" -ForegroundColor Green
Write-Host "IMPORTANT: Encryption Key Check" -ForegroundColor Yellow
Write-Host "If 'get-payment-settings' is failing with 500, you likely need to set the ENCRYPTION_KEY."
Write-Host "Run the following command (replace with a 32-char random string):"
Write-Host "npx supabase secrets set ENCRYPTION_KEY=your-32-char-secure-random-key-here" -ForegroundColor White
Write-Host "---------------------------------------------------" -ForegroundColor Green

Write-Host "Done! Please refresh the app." -ForegroundColor Green
