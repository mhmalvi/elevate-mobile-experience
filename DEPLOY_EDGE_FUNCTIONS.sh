#!/bin/bash

# Edge Functions Deployment Script
# Run this from the project root directory

echo "🚀 Deploying TradieMate Edge Functions to Supabase..."
echo ""

cd supabase

# Deploy all Edge Functions
echo "📦 Deploying xero-oauth (with encryption)..."
supabase functions deploy xero-oauth

echo ""
echo "📦 Deploying xero-sync-clients (with decryption)..."
supabase functions deploy xero-sync-clients

echo ""
echo "📦 Deploying xero-sync-invoices (with decryption)..."
supabase functions deploy xero-sync-invoices

echo ""
echo "📦 Deploying all other functions..."
supabase functions deploy generate-pdf
supabase functions deploy send-notification
supabase functions deploy send-email
supabase functions deploy send-invoice
supabase functions deploy payment-reminder
supabase functions deploy create-payment
supabase functions deploy stripe-webhook
supabase functions deploy create-subscription-checkout
supabase functions deploy check-subscription
supabase functions deploy customer-portal
supabase functions deploy subscription-webhook
supabase functions deploy revenuecat-webhook
supabase functions deploy generate-recurring-invoices
supabase functions deploy send-team-invitation
supabase functions deploy accept-team-invitation
supabase functions deploy create-stripe-connect
supabase functions deploy check-stripe-account

cd ..

echo ""
echo "✅ All Edge Functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Test Xero OAuth flow (connect account)"
echo "2. Test recurring invoice generation (manual GitHub Action trigger)"
echo "3. Test subscription checkout on web"
echo "4. Verify encryption (check database - tokens should be Base64 strings)"
