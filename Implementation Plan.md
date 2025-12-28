     Overview

     Implementing three major features for TradieMate in priority order:
     1. Recurring Invoices - Auto-generate and send invoices on schedule
     2. Custom Branding - Logo, colors, and templates for documents/emails
     3. Role-Based Teams - Multi-user collaboration with permissions

     User Preferences:
     - Recurring invoices: Auto-send emails immediately
     - Team features: Role-based (Owner, Admin, Member, Viewer)
     - Branding: All elements (logo, colors, email templates, custom terms)
     - Priority: Recurring invoices first, then branding, then teams

     ---
     PRIORITY 1: Recurring Invoices

     Implementation Steps

     1. Database Migration

     File: supabase/migrations/20251228_add_recurring_invoice_support.sql

     - Database schema already has required fields (is_recurring, recurring_interval, next_due_date, parent_invoice_id)
     - Add performance indexes for cron queries
     - Create calculate_next_due_date() function
     - Add validation for recurring_interval enum values

     2. Backend - Cron Edge Function

     File: supabase/functions/generate-recurring-invoices/index.ts

     Core Logic:
     1. Query invoices where is_recurring = true AND next_due_date <= NOW()
     2. For each template invoice:
       - Check user's subscription limits
       - Generate new invoice number
       - Copy invoice and line items with new due date
       - Update usage tracking
       - Auto-send email to client
       - Update template's next_due_date
     3. Return results array with success/error status

     Cron Setup: Schedule via Supabase pg_cron to run daily at 6 AM UTC

     3. Frontend - UI Components

     Files to modify:
     - src/components/invoices/RecurringInvoiceToggle.tsx (NEW)
       - Toggle for enabling recurring invoices
       - Dropdown for interval (weekly/monthly/quarterly/yearly)
       - Date picker for next due date
     - src/pages/InvoiceForm.tsx
       - Restore recurring invoice form fields
       - Add RecurringInvoiceToggle component
       - Save recurring fields to database
     - src/components/invoices/RecurringInvoiceHistory.tsx (NEW)
       - Show list of generated child invoices
       - Display invoice number, date, status, total
     - src/pages/InvoiceDetail.tsx
       - Display recurring badge and info
       - Show RecurringInvoiceHistory component
       - Display next due date

     4. Testing Checklist

     - Create recurring invoice via UI
     - Manually trigger edge function
     - Verify new invoice created with correct data
     - Verify line items copied
     - Verify email sent
     - Verify usage tracking incremented
     - Verify template's next_due_date updated
     - Test subscription limit blocking
     - Test all intervals (weekly, monthly, quarterly, yearly)

     ---
     PRIORITY 2: Custom Branding

     Implementation Steps

     1. Database Migration

     File: supabase/migrations/20251228_add_custom_branding.sql

     Create branding_settings table with:
     - Logo: logo_url, logo_position, show_logo_on_documents
     - Colors: primary_color, secondary_color, text_color, accent_color
     - Email: email_header_color, email_footer_text, email_signature
     - Documents: document_header_style, default_quote_terms, default_invoice_terms, document_footer_text
     - Migrate existing logos from profiles table

     2. Backend - PDF & Email Updates

     Files to modify:
     - supabase/functions/generate-pdf/index.ts
       - Fetch branding_settings for user
       - Apply custom colors to PDF template
       - Display logo if enabled
       - Use custom terms/footer text
       - Apply document_header_style (gradient/solid/minimal)
     - supabase/functions/send-email/index.ts
       - Fetch branding_settings for user
       - Apply email_header_color
       - Display logo in email header
       - Include email_signature
       - Use email_footer_text

     3. Frontend - Branding Settings Page

     File: src/pages/settings/BrandingSettings.tsx (NEW)

     Three tabs:
     1. Logo & Colors
       - Logo upload/preview/delete
       - Logo position selector
       - Color pickers for primary/secondary colors
       - Live preview of gradient
     2. Documents
       - Header style selector (gradient/solid/minimal)
       - Show logo toggle
       - Default quote terms textarea
       - Default invoice terms textarea
       - Document footer text input
     3. Emails
       - Email header color picker
       - Email signature textarea
       - Email footer text input

     Files to modify:
     - src/pages/Settings.tsx - Add link to branding settings
     - src/pages/PublicQuote.tsx - Fetch and apply branding
     - src/pages/PublicInvoice.tsx - Fetch and apply branding
     - src/App.tsx - Add route for /settings/branding

     4. Testing Checklist

     - Upload logo - verify appears on PDFs
     - Change primary color - verify in PDFs and public pages
     - Set custom quote terms - verify on quote PDF
     - Set custom invoice terms - verify on invoice PDF
     - Change header style - verify visual changes
     - Set email signature - verify in sent emails
     - Test logo positions (left/center/right)
     - Verify color contrast readability

     ---
     PRIORITY 3: Role-Based Teams

     Implementation Steps

     1. Database Migration (REQUIRES DOWNTIME)

     File: supabase/migrations/20251228_add_team_support.sql

     New tables:
     - teams - Team container with subscription
     - team_members - User membership with roles
     - team_invitations - Pending invitations with tokens

     Data migration:
     1. Create team for each existing user
     2. Add user as owner of their team
     3. Add team_id column to all main tables
     4. Backfill team_id from user_id relationships
     5. Update all RLS policies to use team_id

     Roles & Permissions:
     - Owner: Full access, owns team, manages subscription
     - Admin: Manage members, create/edit/delete all data
     - Member: Create and edit data, cannot delete
     - Viewer: Read-only access

     2. Backend - Invitation System

     Files to create:
     - supabase/functions/send-team-invitation/index.ts
       - Verify inviter has permission (owner/admin)
       - Create invitation record with unique token
       - Send email with invitation link
       - Set 7-day expiration
     - supabase/functions/accept-team-invitation/index.ts
       - Verify invitation is valid and not expired
       - Add user to team with specified role
       - Update user's profile team_id
       - Mark invitation as accepted

     3. Frontend - Team Management

     Files to create:
     - src/hooks/useTeam.tsx (NEW)
       - Fetch user's team and role
       - Provide permission helpers (canCreate, canEdit, canDelete, canManageTeam)
       - Fetch team members list
     - src/pages/settings/TeamSettings.tsx (NEW)
       - Display team info and member count
       - Invite form (email + role selector)
       - Team members list with role badges
       - Change member role (dropdown)
       - Remove member (with confirmation)
     - src/pages/JoinTeam.tsx (NEW)
       - Accept invitation flow
       - Display team name and role
       - Show role permissions
       - Accept button

     Files to modify:
     - src/pages/Settings.tsx - Add link to team settings
     - src/App.tsx - Add routes for /settings/team and /join-team
     - All forms (InvoiceForm, QuoteForm, etc.) - Use useTeam() permissions
     - All detail pages - Check permissions before showing edit/delete

     4. Testing Checklist

     - Migration completes without data loss
     - Existing user auto-assigned to new team
     - Owner can invite admin
     - Admin can invite member
     - Member cannot invite others
     - Accept invitation creates team membership
     - Each role has correct permissions
     - Viewer cannot create/edit
     - Member cannot delete
     - Admin can manage team
     - Owner can transfer ownership
     - RLS prevents cross-team access
     - Subscription applies to whole team

     ---
     Critical Files by Feature

     Recurring Invoices

     - supabase/migrations/20251228_add_recurring_invoice_support.sql
     - supabase/functions/generate-recurring-invoices/index.ts
     - src/pages/InvoiceForm.tsx
     - src/pages/InvoiceDetail.tsx
     - src/components/invoices/RecurringInvoiceToggle.tsx
     - src/components/invoices/RecurringInvoiceHistory.tsx

     Custom Branding

     - supabase/migrations/20251228_add_custom_branding.sql
     - supabase/functions/generate-pdf/index.ts
     - supabase/functions/send-email/index.ts
     - src/pages/settings/BrandingSettings.tsx
     - src/pages/PublicQuote.tsx
     - src/pages/PublicInvoice.tsx

     Role-Based Teams

     - supabase/migrations/20251228_add_team_support.sql
     - supabase/functions/send-team-invitation/index.ts
     - supabase/functions/accept-team-invitation/index.ts
     - src/hooks/useTeam.tsx
     - src/pages/settings/TeamSettings.tsx
     - src/pages/JoinTeam.tsx
     - All RLS policies in migration

     ---
     Implementation Order

     Phase 1: Recurring Invoices (Week 1)

     1. Day 1: Database migration + cron function
     2. Day 2: Frontend UI components
     3. Day 3: Testing and refinement

     Phase 2: Custom Branding (Week 2)

     1. Day 1: Database migration + PDF/email updates
     2. Day 2: Branding settings page
     3. Day 3: Public page updates + testing

     Phase 3: Role-Based Teams (Week 3-4)

     1. Day 1-2: Database migration (requires downtime planning)
     2. Day 3: Invitation system backend
     3. Day 4-5: Team settings UI
     4. Day 6-7: Update all forms/pages with permissions
     5. Day 8: Comprehensive testing

     ---
     Risk Mitigation

     Recurring Invoices:
     - Test cron function manually before enabling
     - Add logging for all generated invoices
     - Monitor subscription limits carefully

     Custom Branding:
     - Validate all color inputs
     - Limit logo file size (2MB max)
     - Sanitize all text inputs to prevent XSS

     Teams (HIGH RISK):
     - Schedule maintenance window for migration
     - Take full database backup
     - Test migration on staging first
     - Have rollback plan ready
     - Document all steps for emergency recovery

     ---
     Success Metrics

     Recurring Invoices:
     - Invoices generated on schedule without errors
     - Emails sent successfully
     - Subscription limits respected
     - User feedback positive

     Custom Branding:
     - Logos appear on all documents
     - Colors applied consistently
     - No accessibility issues (contrast)
     - Professional appearance maintained

     Teams:
     - Zero data loss during migration
     - All existing users migrated successfully
     - Permissions working correctly
     - No cross-team data leakage
     - Team invitations working smoothly