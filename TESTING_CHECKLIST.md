# Testing Checklist - TradieMate Features

## ✅ Deployment Status

- ✅ Database migrations applied successfully
- ✅ Routes updated in App.tsx
- ✅ Settings navigation updated
- ✅ Application built successfully
- ✅ All files deployed

---

## 🧪 Testing Checklist

### Phase 1: Recurring Invoices

#### Creation & Configuration
- [ ] Navigate to Invoices → New Invoice
- [ ] Enable "Recurring Invoice" toggle
- [ ] Select interval (weekly/monthly/quarterly/yearly)
- [ ] Set next due date
- [ ] Create invoice and verify it saves with recurring fields
- [ ] Check that recurring badge shows on invoice detail page

#### Automatic Generation
- [ ] Manually trigger the edge function:
  ```bash
  curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/generate-recurring-invoices \
    -H "Authorization: Bearer YOUR_ANON_KEY"
  ```
- [ ] Verify new invoice is created
- [ ] Check that line items are copied correctly
- [ ] Verify email was sent to client
- [ ] Check usage tracking was incremented
- [ ] Verify template's next_due_date was updated

#### History & Display
- [ ] Open a recurring invoice template
- [ ] Verify "Recurring Invoice History" section shows generated invoices
- [ ] Click on a generated invoice to view details
- [ ] Confirm parent-child relationship is correct

#### Subscription Limits
- [ ] Test with a free tier account (5 invoice limit)
- [ ] Verify recurring invoices respect the limit
- [ ] Upgrade to Solo tier and verify increased limit

---

### Phase 2: Custom Branding

#### Logo Upload
- [ ] Go to Settings → Branding → Logo & Colors tab
- [ ] Upload a logo (test with 2MB file)
- [ ] Try to upload >2MB file (should fail)
- [ ] Change logo position (left/center/right)
- [ ] Remove logo and verify it's deleted

#### Colors
- [ ] Change primary color
- [ ] Change secondary color
- [ ] Change text color
- [ ] Verify colors show in preview

#### Documents
- [ ] Go to Documents tab
- [ ] Select header style (gradient/solid/minimal)
- [ ] Toggle "Show logo on documents"
- [ ] Set default quote terms
- [ ] Set default invoice terms
- [ ] Set document footer text

#### Emails
- [ ] Go to Emails tab
- [ ] Change email header color
- [ ] Set email signature
- [ ] Set email footer text

#### Verification
- [ ] Create a quote and generate PDF
  - [ ] Logo appears (if enabled)
  - [ ] Colors are applied
  - [ ] Custom terms appear
  - [ ] Footer text shows
- [ ] Send an email (quote or invoice)
  - [ ] Logo appears in email header
  - [ ] Email header color is correct
  - [ ] Signature appears
  - [ ] Footer text shows
- [ ] View public quote page (`/q/:id`)
  - [ ] Logo displays in header
  - [ ] Primary color is used
  - [ ] Footer text appears
- [ ] View public invoice page (`/i/:id`)
  - [ ] Logo displays in header
  - [ ] Primary color is used
  - [ ] Footer text appears

---

### Phase 3: Role-Based Teams

#### Team Creation (Automatic)
- [ ] Login with an existing user
- [ ] Verify team was automatically created
- [ ] Check Settings → Team shows your team
- [ ] Verify you're listed as "owner"

#### Inviting Team Members
- [ ] Go to Settings → Team
- [ ] Enter email address
- [ ] Select role (admin/member/viewer)
- [ ] Send invitation
- [ ] Check invitation email was sent

#### Accepting Invitations
- [ ] Open invitation link in incognito/different browser
- [ ] Sign in (or create account) with invited email
- [ ] Verify invitation details show correctly
- [ ] Accept invitation
- [ ] Verify redirected to dashboard
- [ ] Check Settings → Team shows you as member

#### Role Permissions

**Owner Tests:**
- [ ] Create clients, quotes, invoices (should work)
- [ ] Edit any data (should work)
- [ ] Delete any data (should work)
- [ ] Invite team members (should work)
- [ ] Change member roles (should work)
- [ ] Remove team members (should work)

**Admin Tests:**
- [ ] Login as admin user
- [ ] Create clients, quotes, invoices (should work)
- [ ] Edit any data (should work)
- [ ] Delete any data (should work)
- [ ] Invite team members (should work)
- [ ] Change member roles to member/viewer (should work)
- [ ] Cannot promote to admin (should fail/not show option)
- [ ] Remove team members (should work)

**Member Tests:**
- [ ] Login as member user
- [ ] Create clients, quotes, invoices (should work)
- [ ] Edit own data (should work)
- [ ] Try to delete data (should fail or be restricted)
- [ ] Try to invite team members (should fail)
- [ ] Try to change roles (should fail)

**Viewer Tests:**
- [ ] Login as viewer user
- [ ] View clients, quotes, invoices (should work)
- [ ] Try to create data (should fail)
- [ ] Try to edit data (should fail)
- [ ] Try to delete data (should fail)
- [ ] Try to invite team members (should fail)

#### Role Management
- [ ] As owner, change member's role from member to viewer
- [ ] Verify member can no longer create/edit
- [ ] Change back to member
- [ ] Verify member can create/edit again
- [ ] Remove a team member
- [ ] Verify they lose access to team data

#### Data Isolation
- [ ] Create data as User A's team
- [ ] Login as User B (different team)
- [ ] Verify User B cannot see User A's data
- [ ] Verify RLS policies prevent cross-team access
- [ ] Test with all data types (clients, quotes, invoices, jobs)

---

## 🔧 Edge Function Testing

### Generate Recurring Invoices
```bash
# Test the cron function
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/generate-recurring-invoices \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "processed": 5,
  "created": 3,
  "skipped": 1,
  "errors": 1,
  "results": [...]
}
```

### Send Team Invitation
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/send-team-invitation \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "member"}'
```

Expected response:
```json
{
  "success": true,
  "invitation_url": "...",
  "invitation": {...}
}
```

### Accept Team Invitation
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/accept-team-invitation \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token": "INVITATION_TOKEN"}'
```

Expected response:
```json
{
  "success": true,
  "team_id": "...",
  "team_name": "...",
  "role": "member"
}
```

---

## 🐛 Known Issues / Things to Watch

### Recurring Invoices
- Ensure cron job is set up in Supabase Dashboard
- Monitor email sending for failures
- Watch for subscription limit edge cases

### Custom Branding
- Large logos may slow PDF generation
- Test color contrast for accessibility
- Verify mobile display of logos

### Teams
- ⚠️ **CRITICAL**: Test data migration thoroughly
- Watch for RLS policy edge cases
- Test invitation expiry (7 days)
- Monitor cross-team data isolation

---

## 📊 Performance Testing

- [ ] Test with 50+ recurring invoices
- [ ] Generate PDF with large logo
- [ ] Test team with 10+ members
- [ ] Create 100+ invoices and check pagination
- [ ] Test on mobile devices
- [ ] Check load times for public pages

---

## 🔐 Security Testing

- [ ] Try to access another team's data via API
- [ ] Test invitation tokens cannot be reused
- [ ] Verify expired invitations are rejected
- [ ] Test RLS policies prevent unauthorized access
- [ ] Verify subscription limits are enforced
- [ ] Test file upload size limits

---

## ✅ Success Criteria

### Recurring Invoices
- ✅ Invoices generate automatically on schedule
- ✅ Emails sent successfully
- ✅ Subscription limits respected
- ✅ No duplicate invoices created

### Custom Branding
- ✅ Logos appear on all documents
- ✅ Colors applied consistently
- ✅ Good contrast/readability
- ✅ Professional appearance

### Teams
- ✅ Zero data loss during migration
- ✅ All existing users have teams
- ✅ Permissions work correctly
- ✅ No cross-team data leakage
- ✅ Invitations work smoothly

---

## 📝 Notes

- All features are now deployed
- Database migrations applied successfully
- Application built without errors
- Ready for production testing

**Next Steps:**
1. Set up recurring invoice cron job in Supabase Dashboard
2. Test each feature systematically
3. Monitor logs for errors
4. Gather user feedback
5. Iterate and improve

---

**Testing Date:** December 28, 2025
**Tester:** _____________
**Environment:** Production (Supabase: rucuomtojzifrvplhwja)
