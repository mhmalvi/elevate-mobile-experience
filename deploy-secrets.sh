#!/bin/bash
# TradieMate - Deploy Supabase Edge Function Secrets
# This script reads secrets from .env and deploys them to Supabase

echo "========================================"
echo "TradieMate - Deploying Supabase Secrets"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found!"
    exit 1
fi

# Load .env file
echo "Reading secrets from .env..."
export $(grep -v '^#' .env | xargs)

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "ERROR: SUPABASE_ACCESS_TOKEN not found in .env!"
    exit 1
fi

echo "✅ Access token found"
echo ""

# Define secrets to deploy
secrets=(
    "RESEND_API_KEY"
    "EMAIL_FROM_DOMAIN"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "TWILIO_PHONE_NUMBER"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "ENCRYPTION_KEY"
    "XERO_CLIENT_ID"
    "XERO_CLIENT_SECRET"
    "APP_URL"
    "REVENUECAT_WEBHOOK_SECRET"
)

echo "Deploying secrets to Supabase..."
echo ""

success_count=0
fail_count=0
skip_count=0

for secret_key in "${secrets[@]}"; do
    # Get the value from environment
    secret_value="${!secret_key}"
    
    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipped: $secret_key (not found in .env)"
        ((skip_count++))
        continue
    fi
    
    # Deploy the secret
    echo -n "Deploying: $secret_key..."
    
    if npx supabase secrets set "$secret_key=$secret_value" --project-ref rucuomtojzifrvplhwja >/dev/null 2>&1; then
        echo " ✅ Success"
        ((success_count++))
    else
        echo " ❌ Failed"
        ((fail_count++))
    fi
done

echo ""
echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo "✅ Successful: $success_count"
echo "❌ Failed: $fail_count"
echo "⚠️  Skipped: $skip_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "🎉 All secrets deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Test PDF generation in your app"
    echo "2. Test email sending functionality"
    echo "3. Test SMS sending functionality"
    echo ""
    echo "To verify deployed secrets, run:"
    echo "  npx supabase secrets list --project-ref rucuomtojzifrvplhwja"
else
    echo "⚠️  Some secrets failed to deploy. Please review errors above."
fi

echo ""
