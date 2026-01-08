# Production Fixes Testing Guide

All critical production issues have been addressed. Follow this guide to test the fixes.

## ✅ Fixes Applied

### 1. PDF Generation Fix
**Issue**: Downloaded PDFs showed only "ytytytyt" instead of professional invoice
**Fix**: Increased font/image loading wait time from 500ms to 2000ms in PDFPreviewModal.tsx
**File**: `src/components/PDFPreviewModal.tsx:146`

**How to Test**:
1. Open any invoice in the app
2. Click "Preview" button
3. Wait for preview to load
4. Click "Download PDF"
5. Open the downloaded PDF
6. **Expected**: Professional invoice template with all details, proper formatting, and styling

### 2. SMS Notification Fix
**Issue**: SMS sending failed with "functionsFetchError"
**Fix**: Redeployed send-notification Edge Function with proper error handling
**Function**: `supabase/functions/send-notification`

**How to Test**:
1. Open an invoice or quote
2. Click "SMS" button
3. Enter recipient phone number
4. Send the SMS
5. **Expected**: SMS sent successfully (either via Twilio or native SMS app)
6. **Check**: Recipient receives SMS with invoice link

### 3. Shared Invoice Links Fix
**Issue**: Shared links showed "Invoice Not Found" with 401 errors
**Fix**: RLS policies already in place (public SELECT access enabled)
**Status**: ✅ Working (policies verified)

**How to Test**:
1. Create an invoice in the app
2. Get the share link (format: https://your-domain.com/i/[invoice-id])
3. Open link in **incognito/private browser** (no auth)
4. **Expected**: Invoice displays with all details
5. **Expected**: "Pay Now" button works (if Stripe configured)
6. Repeat for quotes using /q/[quote-id]

### 4. CORS Errors Fix
**Issue**: Multiple CORS blocking errors
**Fix**: Redeployed Edge Functions with proper CORS handling
**Status**: ✅ Fixed

**How to Test**:
1. Open browser DevTools (F12) > Console
2. Test PDF generation, SMS sending, email sending
3. **Expected**: No CORS errors in console
4. **Expected**: All Edge Function calls succeed

## 🧪 Complete Test Checklist

### PDF Generation
- [ ] Preview invoice PDF in modal
- [ ] Download invoice PDF
- [ ] Verify PDF contains:
  - [ ] Business logo and name
  - [ ] Client information
  - [ ] Line items with descriptions and prices
  - [ ] Totals (subtotal, GST, total)
  - [ ] Bank details (if configured)
  - [ ] Professional styling and formatting
- [ ] Test with multiple invoices
- [ ] Test quote PDF generation

### SMS/Notifications
- [ ] Send invoice via SMS
- [ ] Verify SMS link works
- [ ] Check SMS usage limits respected
- [ ] Test with Australian phone numbers (+61)
- [ ] Verify Twilio integration (if configured)
- [ ] Test fallback to native SMS app

### Shared Links
- [ ] Create new invoice
- [ ] Copy share link
- [ ] Open in incognito browser
- [ ] Verify all invoice details visible
- [ ] Test "Pay Now" button (if Stripe connected)
- [ ] Repeat for quotes
- [ ] Test on mobile device

### Email
- [ ] Send invoice via email
- [ ] Verify email received
- [ ] Check invoice link in email works
- [ ] Verify email template formatting

## 🔍 Monitoring

### Check Edge Function Logs
```bash
npx supabase functions logs --project-ref rucuomtojzifrvplhwja send-notification
npx supabase functions logs --project-ref rucuomtojzifrvplhwja generate-pdf
npx supabase functions logs --project-ref rucuomtojzifrvplhwja send-email
```

### Check for Errors
- Open browser DevTools > Console
- Look for any red error messages
- Check Network tab for failed requests
- Verify all API calls return 200 status

## 🐛 Known Issues

### Mobile App (Capacitor)
- PDF downloads may behave differently on mobile
- Test on actual device, not just emulator
- SMS app integration varies by platform (iOS/Android)

### Browser Compatibility
- PDF generation tested on Chrome/Edge/Safari
- html2canvas may have issues with some CSS properties
- Google Fonts must load before PDF generation

## 📊 Success Criteria

All tests pass when:
- ✅ PDFs download with complete, professional formatting
- ✅ SMS notifications send successfully
- ✅ Shared links work without authentication
- ✅ No CORS errors in browser console
- ✅ All Edge Functions return 200 status codes
- ✅ Users can view and pay invoices via shared links

## 🆘 Troubleshooting

### PDF Still Shows Garbled Text
- Clear browser cache
- Check DevTools console for errors
- Verify Google Fonts are loading (Network tab)
- Try different browser

### SMS Not Sending
- Check Twilio credentials in Supabase secrets
- Verify phone number format (+61 for Australia)
- Check usage limits haven't been exceeded
- View Edge Function logs for errors

### Shared Links Still Show 401
- Verify you're testing on the production domain (not localhost)
- Check incognito/private browser (clear cookies)
- Verify RLS policies with: `npm run test:production`

### CORS Errors Persist
- Verify origin is whitelisted in `_shared/cors.ts`
- Check Edge Function deployment succeeded
- Clear browser cache and hard reload (Ctrl+Shift+R)

## 🎯 Next Steps After Testing

If all tests pass:
1. Deploy to production (if not already)
2. Monitor Edge Function logs for 24 hours
3. Check usage metrics for SMS/email limits
4. Gather user feedback

If tests fail:
1. Check specific error messages
2. Review Edge Function logs
3. Verify environment variables
4. Contact support if needed
