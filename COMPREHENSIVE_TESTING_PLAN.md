# 🧪 TradieMate - Comprehensive Testing Plan

**Version:** 1.0.0
**Date:** January 6, 2026
**Status:** Ready for Execution

---

## 📋 Table of Contents

1. [Testing Overview](#testing-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Authentication & Onboarding](#authentication--onboarding)
4. [Client Management](#client-management)
5. [Quote Management](#quote-management)
6. [Job Management](#job-management)
7. [Invoice Management](#invoice-management)
8. [Payment Processing](#payment-processing)
9. [Notifications (Email/SMS)](#notifications-emailsms)
10. [Subscription Management](#subscription-management)
11. [Team Collaboration](#team-collaboration)
12. [Settings & Configuration](#settings--configuration)
13. [Integrations](#integrations)
14. [Offline Mode](#offline-mode)
15. [Security Testing](#security-testing)
16. [Performance Testing](#performance-testing)
17. [Mobile Platform Testing](#mobile-platform-testing)
18. [Edge Functions Testing](#edge-functions-testing)
19. [Regression Testing](#regression-testing)
20. [Test Reporting](#test-reporting)

---

## Testing Overview

### Objectives
- Verify all features work as expected across web, iOS, and Android
- Ensure data integrity and security measures are effective
- Validate payment flows and subscription management
- Test offline functionality and sync mechanisms
- Identify and document any bugs or issues

### Testing Methodology
- **Manual Testing:** User journey and UI/UX testing
- **Functional Testing:** Feature-by-feature validation
- **Integration Testing:** Third-party services (Stripe, Xero, Twilio, Resend)
- **Security Testing:** Authentication, authorization, encryption
- **Performance Testing:** Load times, responsiveness
- **Cross-platform Testing:** Web (Chrome, Safari), iOS, Android

### Test Data Requirements
- Test user accounts (Free, Solo, Crew, Pro tiers)
- Sample clients with valid emails and phone numbers
- Test payment cards (Stripe test mode)
- Sample quotes, jobs, and invoices
- Team collaboration test accounts

---

## Test Environment Setup

### Prerequisites Checklist

**Development Environment:**
- [ ] Node.js 18+ installed
- [ ] Supabase CLI installed
- [ ] Android Studio (for Android testing)
- [ ] Xcode (for iOS testing)
- [ ] Git repository cloned

**Environment Variables:**
```env
# Supabase
VITE_SUPABASE_URL=https://rucuomtojzifrvplhwja.supabase.co
VITE_SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_ROLE_KEY=[service_role_key]

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PRICE_ID_SOLO=price_...
VITE_STRIPE_PRICE_ID_CREW=price_...
VITE_STRIPE_PRICE_ID_PRO=price_...

# RevenueCat
VITE_REVENUECAT_ANDROID_API_KEY=sk_...
VITE_REVENUECAT_IOS_API_KEY=sk_...
VITE_REVENUECAT_WEB_API_KEY=sk_...

# Email
RESEND_API_KEY=re_...

# SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Xero (Optional)
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
```

**Test Accounts:**
- [ ] Create 4 test user accounts (Free, Solo, Crew, Pro)
- [ ] Create test Stripe account
- [ ] Set up test phone numbers for SMS
- [ ] Set up test email addresses

**Database State:**
- [ ] Run all migrations: `npx supabase db push`
- [ ] Verify all tables exist
- [ ] Check RLS policies are enabled

**Edge Functions:**
- [ ] Deploy all 23 edge functions
- [ ] Set Supabase secrets (Twilio, Stripe, Resend)
- [ ] Verify function logs are accessible

---

## Authentication & Onboarding

### Test Cases

#### AUTH-001: User Registration
**Priority:** Critical
**Prerequisites:** None

**Steps:**
1. Navigate to app home page
2. Click "Sign Up" button
3. Enter valid email address
4. Enter strong password (min 8 chars, uppercase, lowercase, number)
5. Click "Create Account"
6. Check email for verification link
7. Click verification link
8. Redirected to login page

**Expected Results:**
- ✅ Account created successfully
- ✅ Verification email received within 1 minute
- ✅ Email contains clickable verification link
- ✅ Account activated after clicking link
- ✅ Password strength indicator shows green for strong password

**Test Data:**
- Email: `test+auth001@example.com`
- Password: `TestPass123!`

---

#### AUTH-002: User Login
**Priority:** Critical
**Prerequisites:** Verified user account exists

**Steps:**
1. Navigate to login page
2. Enter email address
3. Enter password
4. Click "Sign In"

**Expected Results:**
- ✅ Redirected to dashboard within 2 seconds
- ✅ User session created
- ✅ User profile loaded

**Test Data:**
- Email: `test+auth001@example.com`
- Password: `TestPass123!`

---

#### AUTH-003: Password Reset
**Priority:** High
**Prerequisites:** User account exists

**Steps:**
1. Navigate to login page
2. Click "Forgot Password"
3. Enter email address
4. Click "Send Reset Link"
5. Check email for reset link
6. Click reset link
7. Enter new password
8. Confirm new password
9. Click "Reset Password"
10. Login with new password

**Expected Results:**
- ✅ Reset email received within 1 minute
- ✅ Reset link works and redirects to password reset form
- ✅ Password successfully updated
- ✅ Can login with new password
- ✅ Old password no longer works

---

#### AUTH-004: Onboarding Flow
**Priority:** High
**Prerequisites:** New user account (first login)

**Steps:**
1. Login for the first time
2. Verify onboarding wizard appears
3. Step 1: Enter business name
4. Step 2: Enter business phone
5. Step 3: Upload logo (optional)
6. Step 4: Select primary trade category
7. Click "Complete Setup"

**Expected Results:**
- ✅ Onboarding wizard shows 4 steps
- ✅ Progress indicator updates
- ✅ Business name saved to profile
- ✅ Phone number saved to profile
- ✅ Logo uploaded to Supabase Storage (if provided)
- ✅ Redirected to dashboard after completion
- ✅ Onboarding wizard doesn't show again

---

#### AUTH-005: Logout
**Priority:** Medium
**Prerequisites:** User logged in

**Steps:**
1. Click user avatar/menu
2. Click "Logout"
3. Confirm logout action

**Expected Results:**
- ✅ Session terminated
- ✅ Redirected to login page
- ✅ Cannot access protected routes without re-login
- ✅ Local storage cleared

---

## Client Management

### Test Cases

#### CLIENT-001: Create New Client
**Priority:** Critical
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Clients page
2. Click "Add Client" button
3. Fill in client form:
   - Name: "Test Client ABC"
   - Email: "client@example.com"
   - Phone: "+61400000001"
   - Company: "ABC Construction"
   - Address: "123 Test St, Sydney NSW 2000"
   - Notes: "Test client notes"
4. Click "Save Client"

**Expected Results:**
- ✅ Client created successfully
- ✅ Toast notification: "Client added successfully"
- ✅ Redirected to client detail page
- ✅ Client appears in clients list
- ✅ All fields saved correctly

**Test Data:**
```json
{
  "name": "Test Client ABC",
  "email": "client@example.com",
  "phone": "+61400000001",
  "company": "ABC Construction",
  "address": "123 Test St, Sydney NSW 2000",
  "notes": "Test client notes"
}
```

---

#### CLIENT-002: Edit Existing Client
**Priority:** High
**Prerequisites:** At least one client exists

**Steps:**
1. Navigate to Clients page
2. Click on existing client
3. Click "Edit" button
4. Modify client details:
   - Change name to "Updated Client Name"
   - Change email to "updated@example.com"
5. Click "Save Changes"

**Expected Results:**
- ✅ Client updated successfully
- ✅ Toast notification: "Client updated successfully"
- ✅ Changes reflected immediately
- ✅ Client history shows update timestamp

---

#### CLIENT-003: Delete Client
**Priority:** High
**Prerequisites:** At least one client exists with no active jobs/invoices

**Steps:**
1. Navigate to Clients page
2. Click on client to delete
3. Click "Delete" button
4. Confirm deletion in dialog
5. Click "Delete Client"

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Client soft-deleted (`deleted_at` timestamp set)
- ✅ Client removed from list
- ✅ Toast notification: "Client deleted successfully"
- ✅ Associated data remains but is inaccessible

---

#### CLIENT-004: Search Clients
**Priority:** Medium
**Prerequisites:** Multiple clients exist

**Steps:**
1. Navigate to Clients page
2. Enter search term in search box: "ABC"
3. Verify results filter in real-time

**Expected Results:**
- ✅ Search filters clients by name, email, company
- ✅ Results update as user types
- ✅ Empty state shown if no matches

---

#### CLIENT-005: Client Details View
**Priority:** Medium
**Prerequisites:** Client with associated quotes, jobs, invoices exists

**Steps:**
1. Navigate to Clients page
2. Click on client with history
3. Verify client details page shows:
   - Contact information
   - Associated quotes
   - Active jobs
   - Invoice history
   - Total revenue

**Expected Results:**
- ✅ All client information displayed
- ✅ Quote/job/invoice counts accurate
- ✅ Total revenue calculated correctly
- ✅ Quick action buttons visible (Create Quote, Create Job, Create Invoice)

---

## Quote Management

### Test Cases

#### QUOTE-001: Create New Quote
**Priority:** Critical
**Prerequisites:** At least one client exists

**Steps:**
1. Navigate to Quotes page
2. Click "Create Quote" button
3. Fill in quote form:
   - Client: Select existing client
   - Title: "Bathroom Renovation Quote"
   - Date: Today's date
   - Valid Until: 30 days from now
   - Line Items:
     * Description: "Labour - Bathroom renovation", Qty: 40, Rate: $80
     * Description: "Materials - Tiles and fixtures", Qty: 1, Rate: $2500
   - Notes: "Includes removal of old fixtures"
4. Click "Save Quote"

**Expected Results:**
- ✅ Quote created successfully
- ✅ Quote number auto-generated (e.g., Q-001)
- ✅ Subtotal calculated: $5,700
- ✅ Tax calculated (10% GST): $570
- ✅ Total calculated: $6,270
- ✅ Toast notification: "Quote created successfully"
- ✅ Redirected to quote detail page

**Test Data:**
```json
{
  "client_id": "[client_uuid]",
  "title": "Bathroom Renovation Quote",
  "date": "2026-01-06",
  "valid_until": "2026-02-05",
  "line_items": [
    {
      "description": "Labour - Bathroom renovation",
      "quantity": 40,
      "rate": 80,
      "amount": 3200
    },
    {
      "description": "Materials - Tiles and fixtures",
      "quantity": 1,
      "rate": 2500,
      "amount": 2500
    }
  ],
  "subtotal": 5700,
  "tax": 570,
  "total": 6270,
  "notes": "Includes removal of old fixtures"
}
```

---

#### QUOTE-002: Edit Quote
**Priority:** High
**Prerequisites:** Quote exists in draft/sent status

**Steps:**
1. Navigate to Quotes page
2. Click on existing quote
3. Click "Edit" button
4. Add new line item:
   - Description: "Disposal fees", Qty: 1, Rate: $150
5. Update notes field
6. Click "Save Changes"

**Expected Results:**
- ✅ Quote updated successfully
- ✅ Totals recalculated automatically
- ✅ Changes saved to database
- ✅ Toast notification shown

---

#### QUOTE-003: Convert Quote to Job
**Priority:** Critical
**Prerequisites:** Quote exists in accepted status

**Steps:**
1. Navigate to quote detail page
2. Click "Convert to Job" button
3. Verify pre-filled job form with quote details
4. Set scheduled date
5. Click "Create Job"

**Expected Results:**
- ✅ Job created from quote
- ✅ Job inherits quote line items
- ✅ Job total matches quote total
- ✅ Quote status updated to "converted"
- ✅ Job linked to original quote
- ✅ Redirected to new job detail page

---

#### QUOTE-004: Send Quote via Email
**Priority:** Critical
**Prerequisites:** Quote exists, client has email address

**Steps:**
1. Navigate to quote detail page
2. Click "Send Quote" button
3. Select "Email" option
4. Verify email preview
5. Click "Send Email"
6. Check client email inbox

**Expected Results:**
- ✅ Email sent successfully
- ✅ Toast notification: "Quote sent via email"
- ✅ Email received within 2 minutes
- ✅ Email contains PDF attachment
- ✅ Email has "View Quote" button
- ✅ Quote status updated to "sent"
- ✅ Email logged in quote history

---

#### QUOTE-005: Send Quote via SMS
**Priority:** Critical
**Prerequisites:** Quote exists, client has phone number, SMS credits available

**Steps:**
1. Navigate to quote detail page
2. Click "Send Quote" button
3. Select "SMS" option
4. Review SMS preview
5. Click "Send SMS"
6. Check client phone

**Expected Results:**
- ✅ SMS sent successfully
- ✅ Toast notification: "Quote sent via SMS"
- ✅ SMS received within 1 minute
- ✅ SMS contains share link to quote
- ✅ Quote status updated to "sent"
- ✅ SMS count decremented from usage limits

---

#### QUOTE-006: Public Quote Link
**Priority:** High
**Prerequisites:** Quote exists

**Steps:**
1. Navigate to quote detail page
2. Click "Share" button
3. Verify toast: "Link copied to clipboard"
4. Open new browser window (incognito mode)
5. Paste link and navigate
6. Verify public quote page loads

**Expected Results:**
- ✅ Share link copied to clipboard
- ✅ Link format: `https://app.tradiemate.com.au/q/[quote_id]`
- ✅ Public page accessible without login
- ✅ Quote displayed professionally
- ✅ Client can accept/reject quote
- ✅ Branding visible (logo, colors)

---

#### QUOTE-007: Generate PDF
**Priority:** High
**Prerequisites:** Quote exists

**Steps:**
1. Navigate to quote detail page
2. Click "Download PDF" button
3. Wait for PDF generation
4. Open downloaded PDF

**Expected Results:**
- ✅ PDF generated within 5 seconds
- ✅ PDF downloaded to device
- ✅ PDF contains all quote details
- ✅ PDF formatted professionally
- ✅ Business logo visible
- ✅ Line items and totals accurate

---

#### QUOTE-008: Delete Quote
**Priority:** Medium
**Prerequisites:** Quote exists, not converted to job

**Steps:**
1. Navigate to quote detail page
2. Click "Delete" button
3. Confirm deletion
4. Verify redirect to quotes list

**Expected Results:**
- ✅ Confirmation dialog shown
- ✅ Quote soft-deleted
- ✅ Quote removed from list
- ✅ Toast notification shown

---

## Job Management

### Test Cases

#### JOB-001: Create New Job
**Priority:** Critical
**Prerequisites:** Client exists

**Steps:**
1. Navigate to Jobs page
2. Click "Create Job" button
3. Fill in job form:
   - Client: Select client
   - Title: "Kitchen Renovation"
   - Status: "scheduled"
   - Scheduled Date: 7 days from now
   - Description: "Full kitchen renovation including cabinets"
   - Location: "456 Job St, Melbourne VIC 3000"
4. Click "Create Job"

**Expected Results:**
- ✅ Job created successfully
- ✅ Job number auto-generated
- ✅ Job appears in jobs list
- ✅ Job visible in calendar view
- ✅ Client associated correctly

---

#### JOB-002: Update Job Status
**Priority:** Critical
**Prerequisites:** Job exists

**Steps:**
1. Navigate to job detail page
2. Change status dropdown:
   - scheduled → in_progress
   - in_progress → completed
3. Verify status changes

**Expected Results:**
- ✅ Status updates immediately
- ✅ Status badge color changes
- ✅ Timestamp recorded for each status change
- ✅ Status change visible in job history

---

#### JOB-003: Job Calendar View
**Priority:** Medium
**Prerequisites:** Multiple jobs with different scheduled dates

**Steps:**
1. Navigate to Jobs page
2. Click "Calendar View" tab
3. Verify jobs displayed on calendar
4. Click on date with job
5. Verify job details shown

**Expected Results:**
- ✅ Calendar displays current month
- ✅ Jobs shown on correct dates
- ✅ Color coding by status
- ✅ Click to view job details
- ✅ Navigate between months

---

#### JOB-004: Convert Job to Invoice
**Priority:** Critical
**Prerequisites:** Job exists in completed status

**Steps:**
1. Navigate to completed job detail page
2. Click "Create Invoice" button
3. Verify pre-filled invoice form
4. Review line items
5. Click "Create Invoice"

**Expected Results:**
- ✅ Invoice created from job
- ✅ Invoice inherits job details
- ✅ Line items transferred correctly
- ✅ Job status shows invoice created
- ✅ Link to invoice visible on job page

---

#### JOB-005: Add Job Notes
**Priority:** Medium
**Prerequisites:** Job exists

**Steps:**
1. Navigate to job detail page
2. Click "Add Note" button
3. Enter note text: "Client requested color change"
4. Click "Save Note"

**Expected Results:**
- ✅ Note added to job
- ✅ Timestamp and author recorded
- ✅ Note visible in job timeline
- ✅ Multiple notes can be added

---

## Invoice Management

### Test Cases

#### INVOICE-001: Create New Invoice
**Priority:** Critical
**Prerequisites:** Client exists

**Steps:**
1. Navigate to Invoices page
2. Click "Create Invoice" button
3. Fill in invoice form:
   - Client: Select client
   - Title: "Kitchen Renovation - Final Invoice"
   - Date: Today
   - Due Date: 14 days from now
   - Line Items:
     * Description: "Labour - 80 hours", Qty: 80, Rate: $85
     * Description: "Materials", Qty: 1, Rate: $5000
   - Payment Terms: "Net 14 days"
4. Click "Create Invoice"

**Expected Results:**
- ✅ Invoice created successfully
- ✅ Invoice number auto-generated (e.g., INV-001)
- ✅ Subtotal: $11,800
- ✅ Tax (10% GST): $1,180
- ✅ Total: $12,980
- ✅ Status: "draft"
- ✅ Balance: $12,980 (unpaid)

---

#### INVOICE-002: Send Invoice via Email
**Priority:** Critical
**Prerequisites:** Invoice exists, client has email

**Steps:**
1. Navigate to invoice detail page
2. Click "Send Invoice" button
3. Select "Email" option
4. Review email preview
5. Click "Send Email"
6. Check client email

**Expected Results:**
- ✅ Email sent successfully
- ✅ Email received within 2 minutes
- ✅ Email contains PDF attachment
- ✅ Email has "Pay Now" button
- ✅ Invoice status updated to "sent"
- ✅ Send timestamp recorded

---

#### INVOICE-003: Send Invoice via SMS
**Priority:** Critical
**Prerequisites:** Invoice exists, client has phone, SMS credits available

**Steps:**
1. Navigate to invoice detail page
2. Click "Send Invoice" button
3. Select "SMS" option
4. Review SMS preview
5. Click "Send SMS"
6. Check client phone

**Expected Results:**
- ✅ SMS sent successfully
- ✅ SMS received within 1 minute
- ✅ SMS contains payment link
- ✅ Invoice status updated to "sent"
- ✅ SMS count decremented

---

#### INVOICE-004: Public Invoice Link
**Priority:** Critical
**Prerequisites:** Invoice exists

**Steps:**
1. Navigate to invoice detail page
2. Click "Share" button
3. Copy link
4. Open in incognito browser
5. Verify public invoice page

**Expected Results:**
- ✅ Link copied to clipboard
- ✅ Link format: `https://app.tradiemate.com.au/i/[invoice_id]`
- ✅ Public page accessible
- ✅ Invoice details visible
- ✅ "Pay Now" button visible
- ✅ Payment status shown

---

#### INVOICE-005: Recurring Invoice Setup
**Priority:** Medium
**Prerequisites:** Invoice exists

**Steps:**
1. Navigate to invoice detail page
2. Click "Make Recurring" toggle
3. Set recurrence:
   - Frequency: Monthly
   - Start Date: Next month
   - End Date: +12 months (or never)
4. Click "Save Recurring Settings"

**Expected Results:**
- ✅ Recurring invoice enabled
- ✅ Next generation date calculated
- ✅ Recurring badge visible
- ✅ Edge function will auto-generate invoice

---

#### INVOICE-006: Mark Invoice as Paid (Manual)
**Priority:** Medium
**Prerequisites:** Invoice exists with balance > 0

**Steps:**
1. Navigate to invoice detail page
2. Click "Mark as Paid" button
3. Enter payment details:
   - Amount: Full balance
   - Payment method: "Bank Transfer"
   - Payment date: Today
   - Reference: "REF123456"
4. Click "Confirm Payment"

**Expected Results:**
- ✅ Invoice status updated to "paid"
- ✅ Balance: $0
- ✅ Payment recorded in history
- ✅ Payment badge shows "Paid"

---

#### INVOICE-007: Download Invoice PDF
**Priority:** High
**Prerequisites:** Invoice exists

**Steps:**
1. Navigate to invoice detail page
2. Click "Download PDF" button
3. Wait for generation
4. Open PDF

**Expected Results:**
- ✅ PDF generated within 5 seconds
- ✅ PDF downloads successfully
- ✅ Invoice details accurate
- ✅ Professional formatting
- ✅ Business logo visible
- ✅ GST information included

---

## Payment Processing

### Test Cases

#### PAYMENT-001: Client Pays Invoice Online (Stripe Checkout)
**Priority:** Critical
**Prerequisites:** Invoice sent, public link accessible

**Steps:**
1. Open public invoice link (as client)
2. Click "Pay Now" button
3. Verify Stripe Checkout page loads
4. Enter test card details:
   - Card: 4242 4242 4242 4242
   - Expiry: 12/28
   - CVC: 123
5. Click "Pay"
6. Wait for redirect

**Expected Results:**
- ✅ Stripe Checkout session created
- ✅ Invoice amount matches Stripe amount
- ✅ Payment processes successfully
- ✅ Redirected to invoice page with success message
- ✅ Invoice status updates to "paid" within 10 seconds (webhook)
- ✅ Balance: $0
- ✅ Payment timestamp recorded

---

#### PAYMENT-002: Stripe Webhook Processing
**Priority:** Critical
**Prerequisites:** Payment completed in PAYMENT-001

**Steps:**
1. Navigate to Supabase Dashboard
2. Go to Edge Functions → stripe-webhook → Logs
3. Find recent `checkout.session.completed` event
4. Verify webhook processed successfully

**Expected Results:**
- ✅ Webhook received within 5 seconds of payment
- ✅ Event type: `checkout.session.completed`
- ✅ Invoice ID matched correctly
- ✅ Invoice status updated to "paid"
- ✅ Payment amount recorded
- ✅ No errors in logs

---

#### PAYMENT-003: Failed Payment Handling
**Priority:** High
**Prerequisites:** Invoice sent

**Steps:**
1. Open public invoice link
2. Click "Pay Now"
3. Enter test card for failure: 4000 0000 0000 0002
4. Complete Stripe form
5. Wait for error

**Expected Results:**
- ✅ Payment declined by Stripe
- ✅ Error message shown to user
- ✅ Invoice status remains "sent"
- ✅ Balance unchanged
- ✅ User can retry payment

---

#### PAYMENT-004: Payment Cancellation
**Priority:** Medium
**Prerequisites:** Invoice sent

**Steps:**
1. Open public invoice link
2. Click "Pay Now"
3. Stripe Checkout opens
4. Click "Back" or close window
5. Return to invoice page

**Expected Results:**
- ✅ Redirected back to invoice page
- ✅ Message: "Payment cancelled"
- ✅ Invoice status unchanged
- ✅ Balance unchanged
- ✅ User can retry payment

---

#### PAYMENT-005: Partial Payment (Future Feature)
**Priority:** Low
**Prerequisites:** Invoice exists with high balance

**Steps:**
1. Navigate to invoice detail
2. Click "Record Payment"
3. Enter partial amount: $500 (total is $1000)
4. Save payment

**Expected Results:**
- ✅ Partial payment recorded
- ✅ Balance reduced by $500
- ✅ Status: "partially_paid"
- ✅ Remaining balance: $500

---

## Notifications (Email/SMS)

### Test Cases

#### NOTIF-001: Email Notification - Quote Sent
**Priority:** Critical
**Prerequisites:** Quote exists, client has email, Resend configured

**Steps:**
1. Send quote via email (see QUOTE-004)
2. Check recipient email inbox
3. Verify email content

**Expected Results:**
- ✅ Email received within 2 minutes
- ✅ From: `[Business Name] <onboarding@resend.dev>`
- ✅ Subject: "Quote #[number] from [Business Name]"
- ✅ Email body contains quote details
- ✅ PDF attached
- ✅ "View Quote" button links to public quote page
- ✅ Professional HTML formatting

---

#### NOTIF-002: Email Notification - Invoice Sent
**Priority:** Critical
**Prerequisites:** Invoice exists, client has email

**Steps:**
1. Send invoice via email (see INVOICE-002)
2. Check recipient email
3. Verify email content

**Expected Results:**
- ✅ Email received within 2 minutes
- ✅ Subject: "Invoice #[number] from [Business Name]"
- ✅ Email body shows invoice amount and due date
- ✅ PDF attached
- ✅ "Pay Now" button visible
- ✅ "View Invoice" button links to public invoice page

---

#### NOTIF-003: SMS Notification - Quote Sent
**Priority:** Critical
**Prerequisites:** Quote exists, client has phone, Twilio configured, SMS credits available

**Steps:**
1. Send quote via SMS (see QUOTE-005)
2. Check recipient phone
3. Verify SMS content

**Expected Results:**
- ✅ SMS received within 1 minute
- ✅ From: TradieMate phone number (+15075967989)
- ✅ Message format: "[Business Name]: Quote #[number] - [link]"
- ✅ Link is short and clickable
- ✅ Link opens public quote page

---

#### NOTIF-004: SMS Notification - Invoice Sent
**Priority:** Critical
**Prerequisites:** Invoice exists, client has phone, SMS credits available

**Steps:**
1. Send invoice via SMS (see INVOICE-003)
2. Check recipient phone
3. Verify SMS content

**Expected Results:**
- ✅ SMS received within 1 minute
- ✅ Message includes invoice number and amount
- ✅ Payment link included
- ✅ Link opens public invoice with "Pay Now" button

---

#### NOTIF-005: Payment Reminder Email
**Priority:** Medium
**Prerequisites:** Invoice overdue (past due date)

**Steps:**
1. Create invoice with due date in past
2. Trigger payment reminder (manual or automated)
3. Check client email

**Expected Results:**
- ✅ Reminder email sent
- ✅ Subject: "Payment Reminder: Invoice #[number] Overdue"
- ✅ Email shows days overdue
- ✅ Payment link included
- ✅ Professional but firm tone

---

#### NOTIF-006: Email Send Failure Handling
**Priority:** High
**Prerequisites:** Invalid email address

**Steps:**
1. Create client with invalid email: "invalid@"
2. Try to send invoice via email
3. Check error handling

**Expected Results:**
- ✅ Error message shown to user
- ✅ Toast: "Failed to send email: Invalid email address"
- ✅ Invoice status remains "draft"
- ✅ Error logged in Supabase logs
- ✅ User can correct email and retry

---

#### NOTIF-007: SMS Send Failure - Insufficient Credits
**Priority:** High
**Prerequisites:** User at SMS limit for current period

**Steps:**
1. Exhaust SMS quota for current subscription tier
2. Attempt to send invoice via SMS
3. Check error handling

**Expected Results:**
- ✅ Error message: "SMS limit reached"
- ✅ Suggestion to upgrade subscription
- ✅ Link to subscription settings
- ✅ Invoice not sent
- ✅ SMS count unchanged

---

## Subscription Management

### Test Cases

#### SUB-001: View Current Subscription
**Priority:** High
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Settings → Subscription
2. View current plan details

**Expected Results:**
- ✅ Current tier displayed (Free/Solo/Crew/Pro)
- ✅ Usage limits shown:
  - Quotes used/limit
  - Invoices used/limit
  - Jobs used/limit
  - SMS used/limit
  - Emails used/limit
- ✅ Next billing date shown (if paid)
- ✅ Upgrade/downgrade options visible

---

#### SUB-002: Upgrade Subscription (Free → Solo)
**Priority:** Critical
**Prerequisites:** User on Free tier

**Steps:**
1. Navigate to Settings → Subscription
2. Click "Upgrade" on Solo plan card
3. Click "Subscribe to Solo Plan"
4. Verify redirect to RevenueCat checkout
5. Complete payment (test mode)
6. Return to app

**Expected Results:**
- ✅ RevenueCat checkout opens
- ✅ Price shown: $29/month
- ✅ Payment processed successfully
- ✅ Subscription status updated to "Solo"
- ✅ Usage limits increased:
  - Quotes: 50
  - Invoices: 50
  - Jobs: 100
  - SMS: 25
  - Emails: 50
- ✅ Toast: "Successfully subscribed to Solo plan"

---

#### SUB-003: Upgrade Subscription (Solo → Crew)
**Priority:** High
**Prerequisites:** User on Solo tier

**Steps:**
1. Navigate to Settings → Subscription
2. Click "Upgrade to Crew" button
3. Complete RevenueCat checkout
4. Verify plan change

**Expected Results:**
- ✅ Subscription upgraded to Crew
- ✅ Price: $49/month
- ✅ Unlimited quotes, invoices, jobs, emails
- ✅ SMS: 100/month
- ✅ Prorated billing handled by RevenueCat

---

#### SUB-004: Upgrade Subscription (Crew → Pro)
**Priority:** High
**Prerequisites:** User on Crew tier

**Steps:**
1. Navigate to Settings → Subscription
2. Click "Upgrade to Pro" button
3. Complete checkout
4. Verify plan change

**Expected Results:**
- ✅ Subscription upgraded to Pro
- ✅ Price: $79/month
- ✅ All limits: Unlimited
- ✅ Premium features unlocked

---

#### SUB-005: Downgrade Subscription
**Priority:** Medium
**Prerequisites:** User on paid tier

**Steps:**
1. Navigate to Settings → Subscription
2. Click "Manage Subscription"
3. Select lower tier
4. Confirm downgrade
5. Acknowledge changes take effect next billing cycle

**Expected Results:**
- ✅ Downgrade scheduled for next billing date
- ✅ Current subscription remains active until end of period
- ✅ Warning shown about reduced limits
- ✅ Confirmation email sent

---

#### SUB-006: Cancel Subscription
**Priority:** Medium
**Prerequisites:** User on paid tier

**Steps:**
1. Navigate to Settings → Subscription
2. Click "Cancel Subscription"
3. Confirm cancellation
4. Verify cancellation

**Expected Results:**
- ✅ Cancellation confirmed
- ✅ Subscription active until end of current period
- ✅ Auto-renewal disabled
- ✅ Downgrade to Free tier scheduled
- ✅ Confirmation toast shown

---

#### SUB-007: Usage Limit Enforcement - Quotes
**Priority:** High
**Prerequisites:** User reached quote limit (e.g., Free tier: 5 quotes)

**Steps:**
1. Create 5 quotes (on Free tier)
2. Attempt to create 6th quote
3. Verify limit enforcement

**Expected Results:**
- ✅ Error message: "Quote limit reached"
- ✅ Modal suggests upgrade
- ✅ Link to subscription page
- ✅ Cannot create additional quotes until upgrade

---

#### SUB-008: Usage Limit Enforcement - SMS
**Priority:** High
**Prerequisites:** User reached SMS limit

**Steps:**
1. Send SMS messages until limit reached
2. Attempt to send one more SMS
3. Check error handling

**Expected Results:**
- ✅ Error: "SMS limit reached for current period"
- ✅ Shows reset date (next billing cycle)
- ✅ Upgrade option shown
- ✅ SMS not sent

---

#### SUB-009: RevenueCat Webhook Processing
**Priority:** Critical
**Prerequisites:** Subscription change occurs

**Steps:**
1. Complete subscription change (upgrade/downgrade/cancel)
2. Check Supabase Edge Functions → revenuecat-webhook → Logs
3. Verify webhook processed

**Expected Results:**
- ✅ Webhook received from RevenueCat
- ✅ Subscription status updated in database
- ✅ Usage limits updated
- ✅ User notified of change
- ✅ No errors in logs

---

## Team Collaboration

### Test Cases

#### TEAM-001: Create Team
**Priority:** Medium
**Prerequisites:** User on Crew or Pro tier

**Steps:**
1. Navigate to Settings → Team
2. Click "Create Team"
3. Enter team name: "ABC Plumbing Team"
4. Click "Create"

**Expected Results:**
- ✅ Team created successfully
- ✅ Current user is team owner
- ✅ Team name saved
- ✅ Team ID generated
- ✅ Redirect to team settings

---

#### TEAM-002: Invite Team Member
**Priority:** Medium
**Prerequisites:** Team exists, user is team owner

**Steps:**
1. Navigate to Settings → Team
2. Click "Invite Member"
3. Enter email: "member@example.com"
4. Select role: "member" (or "admin")
5. Click "Send Invitation"
6. Check invitee's email

**Expected Results:**
- ✅ Invitation sent successfully
- ✅ Email received with invitation link
- ✅ Invitation stored in database
- ✅ Toast: "Invitation sent to member@example.com"

---

#### TEAM-003: Accept Team Invitation
**Priority:** Medium
**Prerequisites:** Team invitation received

**Steps:**
1. Click invitation link in email
2. Create account or login (if existing user)
3. Accept invitation
4. Verify team access

**Expected Results:**
- ✅ User added to team
- ✅ Team data visible to new member
- ✅ Role assigned correctly
- ✅ Access to team clients, quotes, jobs, invoices
- ✅ Invitation marked as accepted

---

#### TEAM-004: Team Member Permissions - Admin
**Priority:** High
**Prerequisites:** Team member with "admin" role

**Steps:**
1. Login as team admin
2. Attempt to:
   - Create/edit/delete clients
   - Create/edit/delete quotes
   - Create/edit/delete jobs
   - Create/edit/delete invoices
   - Invite team members
   - Manage team settings

**Expected Results:**
- ✅ All actions permitted
- ✅ No permission errors
- ✅ Changes visible to all team members

---

#### TEAM-005: Team Member Permissions - Member
**Priority:** High
**Prerequisites:** Team member with "member" role

**Steps:**
1. Login as team member
2. Attempt to:
   - Create/edit clients
   - Create/edit quotes
   - Create/edit jobs
   - Create/edit invoices
   - Invite team members (should fail)
   - Delete team data (should fail)

**Expected Results:**
- ✅ Can create/edit most resources
- ✅ Cannot invite members (permission denied)
- ✅ Cannot delete team
- ✅ Cannot remove owner/admins
- ✅ Error messages clear

---

#### TEAM-006: Remove Team Member
**Priority:** Medium
**Prerequisites:** Team exists with multiple members

**Steps:**
1. Login as team owner
2. Navigate to Settings → Team
3. Find member to remove
4. Click "Remove" button
5. Confirm removal

**Expected Results:**
- ✅ Member removed from team
- ✅ Member loses access to team data
- ✅ Member's created data remains (with attribution)
- ✅ Toast: "Member removed from team"

---

#### TEAM-007: Leave Team
**Priority:** Medium
**Prerequisites:** User is team member (not owner)

**Steps:**
1. Login as team member
2. Navigate to Settings → Team
3. Click "Leave Team"
4. Confirm action

**Expected Results:**
- ✅ User removed from team
- ✅ No longer has access to team data
- ✅ Own data remains (if any)
- ✅ Redirect to personal workspace

---

## Settings & Configuration

### Test Cases

#### SET-001: Update Profile Settings
**Priority:** Medium
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Settings → Profile
2. Update fields:
   - Name: "John Smith"
   - Email: "john.smith@example.com"
   - Phone: "+61400123456"
3. Click "Save Changes"

**Expected Results:**
- ✅ Profile updated successfully
- ✅ Toast: "Profile updated"
- ✅ Changes reflected immediately
- ✅ Email verification sent if email changed

---

#### SET-002: Update Business Settings
**Priority:** High
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Settings → Business
2. Update fields:
   - Business Name: "ABC Plumbing Services"
   - ABN: "12 345 678 901"
   - Address: "789 Business Rd, Sydney NSW 2000"
   - Phone: "+61299887766"
   - Email: "info@abcplumbing.com"
3. Click "Save Changes"

**Expected Results:**
- ✅ Business settings updated
- ✅ ABN validated (11 digits)
- ✅ Changes appear on quotes/invoices
- ✅ Toast notification shown

---

#### SET-003: Upload Business Logo
**Priority:** Medium
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Settings → Branding
2. Click "Upload Logo"
3. Select image file (PNG/JPG, max 2MB)
4. Crop/resize if needed
5. Click "Save Logo"

**Expected Results:**
- ✅ Logo uploaded to Supabase Storage
- ✅ Logo URL saved to profile
- ✅ Logo appears on quotes/invoices
- ✅ Logo visible in public documents
- ✅ Toast: "Logo uploaded successfully"

---

#### SET-004: Customize Brand Colors
**Priority:** Low
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Settings → Branding
2. Select primary color: #FF5733
3. Select secondary color: #33FF57
4. Click "Save Colors"
5. Generate new quote/invoice

**Expected Results:**
- ✅ Colors saved to branding_settings
- ✅ Colors applied to new documents
- ✅ PDF generation uses custom colors
- ✅ Public pages reflect branding

---

#### SET-005: Payment Settings - Bank Account Details
**Priority:** Medium
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Settings → Payments
2. Enter bank details:
   - Bank Name: "Commonwealth Bank"
   - BSB: "062-000"
   - Account Number: "12345678"
   - Account Name: "ABC Plumbing Services"
3. Click "Save Bank Details"

**Expected Results:**
- ✅ Bank details encrypted (AES-GCM)
- ✅ Stored securely in database
- ✅ Bank details appear on invoices (for manual payments)
- ✅ Sensitive fields masked in UI

---

#### SET-006: Notification Preferences
**Priority:** Low
**Prerequisites:** User logged in

**Steps:**
1. Navigate to Settings → Notifications
2. Toggle preferences:
   - Email notifications for new payments: ON
   - SMS notifications for overdue invoices: OFF
   - Weekly summary emails: ON
3. Click "Save Preferences"

**Expected Results:**
- ✅ Preferences saved
- ✅ Notifications sent according to preferences
- ✅ User not spammed with unwanted notifications

---

## Integrations

### Test Cases

#### INT-001: Xero OAuth Connection
**Priority:** Medium
**Prerequisites:** User has Xero account

**Steps:**
1. Navigate to Settings → Integrations
2. Click "Connect Xero"
3. Redirected to Xero login
4. Login to Xero
5. Authorize TradieMate
6. Redirected back to app

**Expected Results:**
- ✅ Xero OAuth flow completes
- ✅ Access token and refresh token saved (encrypted)
- ✅ Xero organization ID stored
- ✅ Status: "Connected"
- ✅ Green checkmark shown
- ✅ "Disconnect" button available

---

#### INT-002: Xero Sync - Clients
**Priority:** Medium
**Prerequisites:** Xero connected

**Steps:**
1. Navigate to Settings → Integrations → Xero
2. Click "Sync Clients"
3. Wait for sync to complete
4. Navigate to Clients page
5. Verify clients synced

**Expected Results:**
- ✅ Sync initiates
- ✅ Progress indicator shown
- ✅ Clients from Xero imported to TradieMate
- ✅ Duplicate clients handled correctly (matched by email)
- ✅ Sync timestamp recorded
- ✅ Toast: "X clients synced from Xero"

---

#### INT-003: Xero Sync - Invoices
**Priority:** Medium
**Prerequisites:** Xero connected, invoices exist in TradieMate

**Steps:**
1. Create invoice in TradieMate
2. Navigate to Settings → Integrations → Xero
3. Click "Sync Invoices to Xero"
4. Wait for sync
5. Login to Xero
6. Verify invoice appears in Xero

**Expected Results:**
- ✅ Invoice sent to Xero API
- ✅ Invoice created in Xero with correct details
- ✅ Line items synced
- ✅ Tax handled correctly (GST)
- ✅ Xero invoice ID stored in TradieMate
- ✅ Link to Xero invoice visible

---

#### INT-004: Xero Token Refresh
**Priority:** High
**Prerequisites:** Xero connected, access token expired

**Steps:**
1. Wait for Xero access token to expire (30 minutes)
2. Attempt Xero sync
3. Verify automatic token refresh

**Expected Results:**
- ✅ Expired token detected
- ✅ Refresh token used to get new access token
- ✅ New tokens saved (encrypted)
- ✅ Sync proceeds without user intervention
- ✅ No error shown to user

---

#### INT-005: Disconnect Xero
**Priority:** Medium
**Prerequisites:** Xero connected

**Steps:**
1. Navigate to Settings → Integrations
2. Click "Disconnect Xero"
3. Confirm disconnection

**Expected Results:**
- ✅ Confirmation dialog shown
- ✅ Xero tokens deleted from database
- ✅ Xero organization ID cleared
- ✅ Status: "Not Connected"
- ✅ "Connect Xero" button available
- ✅ Toast: "Xero disconnected"

---

## Offline Mode

### Test Cases

#### OFFLINE-001: Enable Offline Mode
**Priority:** High
**Prerequisites:** User logged in, internet connected

**Steps:**
1. Navigate to Settings → Advanced
2. Toggle "Enable Offline Mode" ON
3. Wait for initial sync

**Expected Results:**
- ✅ Service worker registered
- ✅ IndexedDB created
- ✅ Essential data synced to IndexedDB:
  - Clients
  - Quotes
  - Jobs
  - Invoices
  - Profile
- ✅ Encryption key generated and stored securely
- ✅ Toast: "Offline mode enabled"

---

#### OFFLINE-002: Create Client Offline
**Priority:** High
**Prerequisites:** Offline mode enabled, internet disconnected

**Steps:**
1. Disconnect internet
2. Navigate to Clients page
3. Create new client:
   - Name: "Offline Test Client"
   - Email: "offline@example.com"
4. Click "Save Client"

**Expected Results:**
- ✅ Client saved to IndexedDB
- ✅ Toast: "Saved offline - will sync when online"
- ✅ Client appears in list
- ✅ Offline badge visible
- ✅ Sync status: "Pending"

---

#### OFFLINE-003: Create Quote Offline
**Priority:** High
**Prerequisites:** Offline mode enabled, offline client exists

**Steps:**
1. Ensure internet disconnected
2. Create quote for offline client
3. Add line items
4. Save quote

**Expected Results:**
- ✅ Quote saved to IndexedDB
- ✅ Quote ID generated (temporary UUID)
- ✅ Offline indicator shown
- ✅ Quote accessible in app

---

#### OFFLINE-004: Sync Offline Data When Online
**Priority:** Critical
**Prerequisites:** Offline changes pending, internet reconnected

**Steps:**
1. Reconnect internet
2. Wait for automatic sync (or trigger manually)
3. Verify sync process

**Expected Results:**
- ✅ Offline data detected
- ✅ Sync initiated automatically
- ✅ Clients uploaded to Supabase
- ✅ Quotes uploaded to Supabase
- ✅ Server-generated IDs replace temporary IDs
- ✅ Offline badges removed
- ✅ Toast: "Synced X items"
- ✅ No data loss

---

#### OFFLINE-005: Conflict Resolution
**Priority:** High
**Prerequisites:** Same record modified offline and online

**Steps:**
1. Edit client online (via web on another device)
2. Edit same client offline (on current device)
3. Reconnect internet
4. Observe conflict resolution

**Expected Results:**
- ✅ Conflict detected
- ✅ User prompted to resolve conflict (choose version)
- ✅ Selected version saved
- ✅ Other version kept in history/backup
- ✅ No data overwritten silently

---

#### OFFLINE-006: Encryption of Offline Data
**Priority:** Critical
**Prerequisites:** Offline mode enabled

**Steps:**
1. Open browser DevTools
2. Navigate to Application → IndexedDB
3. Inspect stored data
4. Verify encryption

**Expected Results:**
- ✅ Sensitive fields encrypted (AES-GCM)
- ✅ Client data encrypted
- ✅ Invoice data encrypted
- ✅ Encryption key stored in secure storage (not visible in IndexedDB)
- ✅ Data unreadable without decryption key

---

## Security Testing

### Test Cases

#### SEC-001: SQL Injection Prevention
**Priority:** Critical
**Prerequisites:** User logged in

**Steps:**
1. Attempt SQL injection in search fields:
   - Client search: `'; DROP TABLE clients; --`
   - Invoice search: `' OR '1'='1`
2. Submit forms with malicious input
3. Verify no database errors

**Expected Results:**
- ✅ Input sanitized
- ✅ No SQL errors
- ✅ No unauthorized database access
- ✅ RLS policies prevent data leakage
- ✅ Queries parameterized

---

#### SEC-002: XSS Prevention
**Priority:** Critical
**Prerequisites:** User can create clients/quotes

**Steps:**
1. Create client with XSS payload:
   - Name: `<script>alert('XSS')</script>`
   - Notes: `<img src=x onerror=alert('XSS')>`
2. View client detail page
3. Verify script doesn't execute

**Expected Results:**
- ✅ Script tags escaped/sanitized
- ✅ No alert dialogs
- ✅ Content displayed safely
- ✅ DOMPurify sanitization active

---

#### SEC-003: CSRF Protection
**Priority:** High
**Prerequisites:** User logged in

**Steps:**
1. Inspect network requests
2. Verify CSRF tokens present
3. Attempt to replay requests without token

**Expected Results:**
- ✅ CSRF tokens included in state-changing requests
- ✅ Tokens validated server-side
- ✅ Replay attacks rejected
- ✅ 403 Forbidden for invalid tokens

---

#### SEC-004: Row-Level Security (RLS)
**Priority:** Critical
**Prerequisites:** Multiple users exist

**Steps:**
1. Login as User A
2. Create client
3. Note client UUID
4. Logout
5. Login as User B
6. Attempt to access User A's client via direct URL

**Expected Results:**
- ✅ User B cannot see User A's client
- ✅ Database query returns empty (RLS blocks)
- ✅ 404 or "Access Denied" error
- ✅ No data leakage in error messages

---

#### SEC-005: Sensitive Data Encryption
**Priority:** Critical
**Prerequisites:** User enters bank account details

**Steps:**
1. Navigate to Settings → Payments
2. Enter bank details
3. Save
4. Check database via Supabase dashboard
5. Inspect `profiles` table → bank account columns

**Expected Results:**
- ✅ Bank BSB encrypted (not plaintext)
- ✅ Account number encrypted
- ✅ AES-GCM encryption used
- ✅ Encryption keys not visible in database
- ✅ Decryption only happens server-side

---

#### SEC-006: Authentication Token Security
**Priority:** Critical
**Prerequisites:** User logged in

**Steps:**
1. Open browser DevTools → Application → Local Storage
2. Find Supabase auth tokens
3. Verify token characteristics
4. Attempt to use expired token

**Expected Results:**
- ✅ Tokens stored in httpOnly cookies (if possible)
- ✅ Short-lived access tokens (1 hour)
- ✅ Refresh tokens rotated
- ✅ Expired tokens rejected
- ✅ Token refresh handled automatically

---

#### SEC-007: Webhook Signature Verification
**Priority:** Critical
**Prerequisites:** Stripe webhook configured

**Steps:**
1. Send test webhook from Stripe Dashboard
2. Check stripe-webhook edge function logs
3. Verify signature validation

**Expected Results:**
- ✅ Webhook signature verified
- ✅ Invalid signatures rejected
- ✅ Replay attacks prevented (idempotency keys)
- ✅ Only valid Stripe events processed

---

#### SEC-008: API Rate Limiting
**Priority:** Medium
**Prerequisites:** API access

**Steps:**
1. Send 100 rapid requests to edge function
2. Observe rate limiting

**Expected Results:**
- ✅ Rate limits enforced
- ✅ 429 Too Many Requests returned after threshold
- ✅ Retry-After header provided
- ✅ Legitimate requests not blocked

---

## Performance Testing

### Test Cases

#### PERF-001: Page Load Time
**Priority:** High
**Prerequisites:** Production build

**Steps:**
1. Open Chrome DevTools → Network
2. Enable "Disable cache"
3. Navigate to Dashboard page
4. Measure load time

**Expected Results:**
- ✅ First Contentful Paint (FCP) < 1.5s
- ✅ Time to Interactive (TTI) < 3s
- ✅ Total page load < 5s
- ✅ Lighthouse Performance score > 80

---

#### PERF-002: Large Dataset Rendering
**Priority:** Medium
**Prerequisites:** 100+ clients in database

**Steps:**
1. Navigate to Clients page
2. Measure render time
3. Scroll through list

**Expected Results:**
- ✅ Initial render < 2s
- ✅ Smooth scrolling (60fps)
- ✅ Virtualization/pagination implemented
- ✅ No UI freezing

---

#### PERF-003: PDF Generation Performance
**Priority:** Medium
**Prerequisites:** Invoice with 20+ line items

**Steps:**
1. Open invoice detail page
2. Click "Download PDF"
3. Measure generation time

**Expected Results:**
- ✅ PDF generated in < 10s
- ✅ Progress indicator shown
- ✅ UI remains responsive
- ✅ No memory leaks

---

#### PERF-004: Offline Data Sync Performance
**Priority:** Medium
**Prerequisites:** 50+ offline changes pending

**Steps:**
1. Create 50 records offline
2. Reconnect internet
3. Measure sync time

**Expected Results:**
- ✅ Sync completes in < 30s
- ✅ Progress indicator shown
- ✅ Batch processing efficient
- ✅ No duplicate submissions

---

#### PERF-005: Mobile App Launch Time
**Priority:** High
**Prerequisites:** Android/iOS app installed

**Steps:**
1. Close app completely
2. Launch app
3. Measure time to interactive dashboard

**Expected Results:**
- ✅ Cold start < 3s
- ✅ Warm start < 1s
- ✅ Splash screen shown appropriately
- ✅ No white screen flash

---

## Mobile Platform Testing

### Test Cases

#### MOBILE-001: Android Build & Install
**Priority:** Critical
**Prerequisites:** Android Studio configured

**Steps:**
1. Run: `npm run build`
2. Run: `npx cap sync android`
3. Run: `npx cap open android`
4. Build APK in Android Studio
5. Install on physical Android device
6. Launch app

**Expected Results:**
- ✅ Build succeeds without errors
- ✅ APK installs successfully
- ✅ App launches without crashes
- ✅ All features functional on Android

---

#### MOBILE-002: iOS Build & Install
**Priority:** Critical
**Prerequisites:** Xcode configured, Apple Developer account

**Steps:**
1. Run: `npm run build`
2. Run: `npx cap sync ios`
3. Run: `npx cap open ios`
4. Build app in Xcode
5. Install on physical iOS device
6. Launch app

**Expected Results:**
- ✅ Build succeeds without errors
- ✅ App installs successfully
- ✅ App launches without crashes
- ✅ All features functional on iOS

---

#### MOBILE-003: Push Notifications (Future)
**Priority:** Low
**Prerequisites:** FCM configured

**Steps:**
1. Enable notifications in app
2. Trigger test notification from backend
3. Verify notification received

**Expected Results:**
- ✅ Notification appears in notification tray
- ✅ Tapping notification opens relevant screen
- ✅ Notification content accurate

---

#### MOBILE-004: Camera Access for Logo Upload
**Priority:** Medium
**Prerequisites:** Mobile device with camera

**Steps:**
1. Navigate to Settings → Branding
2. Click "Upload Logo"
3. Select "Take Photo"
4. Take photo with camera
5. Crop and save

**Expected Results:**
- ✅ Camera permission requested
- ✅ Camera opens successfully
- ✅ Photo captured
- ✅ Photo uploaded
- ✅ Logo appears in app

---

#### MOBILE-005: Deep Links
**Priority:** Medium
**Prerequisites:** Mobile app installed

**Steps:**
1. Send public invoice link via email/SMS
2. Open link on mobile device
3. Verify app opens (if installed)

**Expected Results:**
- ✅ Deep link handled by app
- ✅ App opens to invoice detail page
- ✅ Falls back to web if app not installed

---

## Edge Functions Testing

### Test Cases

#### EDGE-001: Test All Edge Functions Deployed
**Priority:** Critical
**Prerequisites:** Supabase project configured

**Steps:**
1. Run: `npx supabase functions list --project-ref rucuomtojzifrvplhwja`
2. Verify all 23 functions listed
3. Check deployment status

**Expected Results:**
- ✅ All 23 functions deployed:
  - accept-team-invitation
  - check-stripe-account
  - check-subscription
  - create-payment
  - create-stripe-connect
  - create-subscription-checkout
  - customer-portal
  - delete-account
  - generate-pdf
  - generate-recurring-invoices
  - get-payment-settings
  - payment-reminder
  - revenuecat-webhook
  - send-email
  - send-invoice
  - send-notification
  - send-team-invitation
  - stripe-webhook
  - subscription-webhook
  - update-payment-settings
  - xero-oauth
  - xero-sync-clients
  - xero-sync-invoices
- ✅ All functions show "active" status

---

#### EDGE-002: Test generate-pdf Function
**Priority:** High
**Prerequisites:** Invoice exists

**Steps:**
1. Call generate-pdf function via API:
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/generate-pdf \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "[uuid]", "type": "invoice"}'
```
2. Verify response

**Expected Results:**
- ✅ Status: 200 OK
- ✅ Response contains base64 PDF
- ✅ PDF decodes correctly
- ✅ PDF contains invoice data
- ✅ Execution time < 10s

---

#### EDGE-003: Test send-email Function
**Priority:** Critical
**Prerequisites:** Resend API key configured

**Steps:**
1. Call send-email function:
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>Test message</p>"
  }'
```
2. Check recipient inbox

**Expected Results:**
- ✅ Status: 200 OK
- ✅ Email sent successfully
- ✅ Email received within 2 minutes
- ✅ No CORS errors
- ✅ Function logs show success

---

#### EDGE-004: Test send-notification Function
**Priority:** Critical
**Prerequisites:** Twilio credentials configured

**Steps:**
1. Call send-notification function:
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer [JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+61400000000",
    "message": "Test SMS from TradieMate"
  }'
```
2. Check recipient phone

**Expected Results:**
- ✅ Status: 200 OK
- ✅ SMS sent successfully
- ✅ SMS received within 1 minute
- ✅ Twilio credentials working

---

#### EDGE-005: Test stripe-webhook Function
**Priority:** Critical
**Prerequisites:** Stripe webhook configured

**Steps:**
1. Send test webhook from Stripe Dashboard
2. Navigate to Supabase → Edge Functions → stripe-webhook → Logs
3. Verify webhook processed

**Expected Results:**
- ✅ Webhook received
- ✅ Signature verified
- ✅ Event processed correctly
- ✅ Database updated
- ✅ No errors in logs

---

#### EDGE-006: Test revenuecat-webhook Function
**Priority:** Critical
**Prerequisites:** RevenueCat webhook configured

**Steps:**
1. Send test webhook from RevenueCat Dashboard
2. Check revenuecat-webhook function logs
3. Verify subscription status updated

**Expected Results:**
- ✅ Webhook received
- ✅ Event type recognized
- ✅ Subscription status updated in database
- ✅ Usage limits updated

---

## Regression Testing

### Test Cases

#### REGR-001: Critical User Journeys - New User Signup to First Invoice
**Priority:** Critical
**Prerequisites:** Fresh database state

**Steps:**
1. Sign up new user
2. Complete onboarding
3. Create first client
4. Create first invoice
5. Send invoice via email
6. Client pays invoice
7. Verify invoice marked paid

**Expected Results:**
- ✅ All steps complete without errors
- ✅ End-to-end flow works
- ✅ Data persists correctly

---

#### REGR-002: Subscription Upgrade Flow
**Priority:** High
**Prerequisites:** User on Free tier

**Steps:**
1. Login as Free user
2. Reach quote limit
3. Attempt to create quote (blocked)
4. Upgrade to Solo
5. Create quote (now allowed)

**Expected Results:**
- ✅ Limit enforcement works
- ✅ Upgrade flow smooth
- ✅ Limits updated immediately
- ✅ Features unlocked

---

#### REGR-003: Team Collaboration Full Flow
**Priority:** Medium
**Prerequisites:** User on Crew tier

**Steps:**
1. Create team
2. Invite member
3. Member accepts
4. Member creates invoice
5. Owner views invoice
6. Remove member
7. Verify member loses access

**Expected Results:**
- ✅ Full team flow works
- ✅ Permissions respected
- ✅ Data sharing correct
- ✅ Removal works

---

## Test Reporting

### Test Execution Tracking

**Use this template to track test execution:**

| Test ID | Test Name | Status | Priority | Executed By | Date | Notes |
|---------|-----------|--------|----------|-------------|------|-------|
| AUTH-001 | User Registration | ⬜ Not Run | Critical | | | |
| AUTH-002 | User Login | ⬜ Not Run | Critical | | | |
| ... | ... | ... | ... | | | |

**Status Codes:**
- ⬜ Not Run
- ✅ Pass
- ❌ Fail
- ⚠️ Partial Pass (with issues)
- 🔄 In Progress

### Bug Report Template

When a test fails, log the bug with this format:

```markdown
## Bug Report

**Bug ID:** BUG-001
**Test Case:** AUTH-003
**Severity:** High
**Priority:** Critical
**Status:** Open

**Summary:**
Password reset email not received

**Steps to Reproduce:**
1. Navigate to login page
2. Click "Forgot Password"
3. Enter email: test@example.com
4. Click "Send Reset Link"

**Expected Result:**
Email received within 1 minute

**Actual Result:**
No email received after 10 minutes

**Environment:**
- Browser: Chrome 131
- OS: Windows 11
- Build: v1.0.0

**Screenshots:**
[Attach screenshots]

**Logs:**
[Paste relevant logs]

**Assigned To:**
[Developer name]

**Fix Notes:**
[Resolution details when fixed]
```

---

## Testing Schedule

### Phase 1: Core Functionality (Week 1)
- [ ] Authentication & Onboarding
- [ ] Client Management
- [ ] Quote Management
- [ ] Invoice Management
- [ ] Payment Processing

### Phase 2: Communications & Subscriptions (Week 1)
- [ ] Email Notifications
- [ ] SMS Notifications
- [ ] Subscription Management
- [ ] Settings & Configuration

### Phase 3: Advanced Features (Week 2)
- [ ] Team Collaboration
- [ ] Integrations (Xero)
- [ ] Offline Mode
- [ ] Edge Functions

### Phase 4: Security & Performance (Week 2)
- [ ] Security Testing
- [ ] Performance Testing
- [ ] Mobile Platform Testing

### Phase 5: Regression & Final Validation (Week 3)
- [ ] Regression Testing
- [ ] User Acceptance Testing
- [ ] Final Bug Fixes
- [ ] Production Deployment

---

## Success Criteria

### Must Pass (Blocking Issues)
- ✅ All Critical priority tests pass
- ✅ No security vulnerabilities
- ✅ Payment flow works end-to-end
- ✅ Email/SMS notifications functional
- ✅ Mobile apps build and install
- ✅ No data loss or corruption

### Should Pass (Non-blocking)
- ✅ All High priority tests pass
- ✅ Performance benchmarks met
- ✅ Offline mode functional
- ✅ Xero integration working

### Nice to Have
- ✅ All Medium priority tests pass
- ✅ Low priority tests pass
- ✅ 100% test coverage

---

## Deployment Readiness Checklist

Before deploying to production:

**Functionality:**
- [ ] All critical tests passing
- [ ] All high priority tests passing
- [ ] Payment flow tested end-to-end
- [ ] Notifications working (email + SMS)
- [ ] Subscription management verified

**Security:**
- [ ] All security tests passing
- [ ] RLS policies enforced
- [ ] Encryption validated
- [ ] Webhook signatures verified
- [ ] Authentication secure

**Performance:**
- [ ] Page load times acceptable
- [ ] Mobile app responsive
- [ ] PDF generation performant
- [ ] No memory leaks

**Infrastructure:**
- [ ] All edge functions deployed
- [ ] All secrets configured
- [ ] Database migrations applied
- [ ] Monitoring configured
- [ ] Backups enabled

**Documentation:**
- [ ] User guide created
- [ ] API documentation updated
- [ ] Known issues documented
- [ ] Support contact available

---

**End of Comprehensive Testing Plan**

**Version:** 1.0.0
**Last Updated:** January 6, 2026
