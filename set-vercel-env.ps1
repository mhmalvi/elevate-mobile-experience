# Set Vercel Environment Variables
# This script adds all required environment variables to your Vercel project

Write-Host "🚀 Setting Vercel Environment Variables..." -ForegroundColor Green
Write-Host ""

# Function to set environment variable
function Set-VercelEnv {
    param (
        [string]$Name,
        [string]$Value,
        [string]$Scope = "production,preview,development"
    )

    Write-Host "Setting $Name..." -ForegroundColor Cyan

    # Use echo to pipe the value to vercel env add
    $command = "echo `"$Value`" | vercel env add $Name $Scope --force"
    Invoke-Expression $command

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $Name set successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set $Name" -ForegroundColor Red
    }
    Write-Host ""
}

# Supabase Variables
Write-Host "📦 Setting Supabase variables..." -ForegroundColor Yellow
Set-VercelEnv -Name "VITE_SUPABASE_URL" -Value "https://rucuomtojzifrvplhwja.supabase.co"
Set-VercelEnv -Name "VITE_SUPABASE_ANON_KEY" -Value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3VvbXRvanppZnJ2cGxod2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MzE2ODIsImV4cCI6MjA4MjQwNzY4Mn0.iZ8553hd90t1-8_V6mxaZGsR3WR-iCfp-O_nvtZG-s8"
Set-VercelEnv -Name "VITE_SUPABASE_PROJECT_ID" -Value "rucuomtojzifrvplhwja"

# RevenueCat Variables
Write-Host "📦 Setting RevenueCat variables..." -ForegroundColor Yellow
Set-VercelEnv -Name "VITE_REVENUECAT_ANDROID_API_KEY" -Value "sk_RaPieGIXYSWkXUvztlmmuERESyqZk"
Set-VercelEnv -Name "VITE_REVENUECAT_IOS_API_KEY" -Value "sk_IigVSHMnIvIGZLJOxKQewiFvMQPrW"
Set-VercelEnv -Name "VITE_REVENUECAT_WEB_API_KEY" -Value "sk_IigVSHMnIvIGZLJOxKQewiFvMQPrW"

# Stripe Variables
Write-Host "📦 Setting Stripe variables..." -ForegroundColor Yellow
Set-VercelEnv -Name "VITE_STRIPE_PRICE_ID_SOLO" -Value "price_1SiyYiHfG2W0TmGhQDHUiQkt"
Set-VercelEnv -Name "VITE_STRIPE_PRICE_ID_CREW" -Value "price_1SiybGHfG2W0TmGh4QYBj996"
Set-VercelEnv -Name "VITE_STRIPE_PRICE_ID_PRO" -Value "price_1SiybvHfG2W0TmGh0DdDE5xt"

Write-Host ""
Write-Host "✅ All environment variables have been set!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Redeploying to apply changes..." -ForegroundColor Yellow
vercel --prod --yes

Write-Host ""
Write-Host "🎉 Deployment complete! Your app is live with all environment variables." -ForegroundColor Green
