#!/bin/bash

# Deploy all secrets to Supabase Edge Functions
# This ensures all functions have access to required API keys

PROJECT_REF="rucuomtojzifrvplhwja"

echo "🚀 Deploying secrets to Supabase Edge Functions..."
echo ""

# Read secrets from .env and deploy to Supabase
npx supabase secrets set ENCRYPTION_KEY="$(grep ENCRYPTION_KEY .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set RESEND_API_KEY="$(grep RESEND_API_KEY .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set STRIPE_SECRET_KEY="$(grep STRIPE_SECRET_KEY .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set STRIPE_WEBHOOK_SECRET="$(grep STRIPE_WEBHOOK_SECRET .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set TWILIO_ACCOUNT_SID="$(grep TWILIO_ACCOUNT_SID .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set TWILIO_AUTH_TOKEN="$(grep TWILIO_AUTH_TOKEN .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set TWILIO_PHONE_NUMBER="$(grep TWILIO_PHONE_NUMBER .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set XERO_CLIENT_ID="$(grep XERO_CLIENT_ID .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set XERO_CLIENT_SECRET="$(grep XERO_CLIENT_SECRET .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set XERO_REDIRECT_URI="$(grep XERO_REDIRECT_URI .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set APP_URL="$(grep APP_URL .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET="$(grep REVENUECAT_WEBHOOK_SECRET .env | cut -d'=' -f2 | tr -d '\"')" --project-ref $PROJECT_REF

echo ""
echo "✅ All secrets deployed!"
echo ""
echo "🔄 Redeploying critical Edge Functions with new secrets..."
echo ""

# Redeploy critical functions to pick up new secrets
npx supabase functions deploy send-email --project-ref $PROJECT_REF
npx supabase functions deploy send-notification --project-ref $PROJECT_REF
npx supabase functions deploy create-payment --project-ref $PROJECT_REF
npx supabase functions deploy xero-oauth --project-ref $PROJECT_REF
npx supabase functions deploy xero-sync-invoices --project-ref $PROJECT_REF
npx supabase functions deploy xero-sync-clients --project-ref $PROJECT_REF
npx supabase functions deploy generate-pdf --project-ref $PROJECT_REF

echo ""
echo "✅ Deployment complete! All features should now be functional."
echo ""
echo "🧪 Next step: Test the features in your app"
