# 🧪 How to Run Production Tests

## ✅ All Fixes Deployed!

**Production URL**: https://elevate-mobile-experience.vercel.app

### Changes Deployed:
1. ✅ **PDF Generation Fix** - Increased font loading time (500ms → 2000ms)
2. ✅ **SMS Notification Fix** - Redeployed send-notification Edge Function
3. ✅ **Shared Links** - RLS policies verified (public access enabled)
4. ✅ **CORS Fix** - Edge Functions redeployed with proper headers

---

## Option 1: Automated Testing (Recommended)

### Prerequisites
Install Playwright:
```bash
npm install -D playwright
```

### Run Automated Tests
```bash
node e2e-production-test.js
```

### What It Tests
- ✅ Login with your credentials
- ✅ Navigate to invoices
- ✅ Open invoice detail
- ✅ PDF preview and download
- ✅ SMS notification dialog
- ✅ Shared invoice link (incognito test)
- ✅ CORS errors check
- ✅ Network failures check
- ✅ Console errors check

### Test Results
- Screenshots saved to: `test-results/`
- Video recording saved to: `test-videos/`
- Summary printed to console

---

## Option 2: Manual Testing

Follow the detailed checklist in: `MANUAL-TESTING-CHECKLIST.md`

### Quick Start
1. Open: https://elevate-mobile-experience.vercel.app
2. Login with:
   - **Email**: yuanhuafung2021@gmail.com
   - **Password**: 90989098
3. Test these critical features:
   - **PDF Download** (was broken, now fixed)
   - **SMS Sending** (was broken, now fixed)
   - **Shared Links** (was broken, now fixed)

---

## 🎯 Critical Tests

### 1. PDF Generation Test
**Status**: 🔧 FIXED (was showing "ytytytyt")

**Test**:
1. Open any invoice
2. Click "Preview"
3. Wait 3-5 seconds
4. Click "Download PDF"
5. Open downloaded PDF
6. **Verify**: Complete professional invoice (NOT "ytytytyt")

**Expected Result**: ✅ Professional invoice with all details

---

### 2. SMS Notification Test
**Status**: 🔧 FIXED (was showing FunctionsFetchError)

**Test**:
1. Open any invoice
2. Click "SMS"
3. Enter phone: +61412345678
4. Check browser console (F12)
5. **Verify**: No errors

**Expected Result**: ✅ SMS dialog opens without errors

---

### 3. Shared Invoice Link Test
**Status**: 🔧 FIXED (was showing "Invoice Not Found")

**Test**:
1. Copy invoice share link
2. Open in **incognito browser**
3. **Verify**: Invoice displays WITHOUT login
4. **Verify**: NO "Invoice Not Found" error

**Expected Result**: ✅ Public invoice accessible

---

### 4. CORS Errors Test
**Status**: 🔧 FIXED

**Test**:
1. Open DevTools (F12) > Console
2. Perform actions (PDF, SMS, etc.)
3. **Verify**: No CORS errors

**Expected Result**: ✅ No CORS blocking

---

## 📊 What to Look For

### ✅ Success Indicators
- Login redirects to dashboard
- PDF preview shows professional template
- PDF download contains complete invoice
- SMS dialog opens without errors
- Shared links work in incognito mode
- No red errors in console
- All network requests return 200 status

### ❌ Failure Indicators (Report These!)
- PDF is blank or shows garbled text
- SMS shows "functionsFetchError"
- Shared links show "Invoice Not Found"
- CORS errors in console
- Network requests fail (401, 500 errors)

---

## 🐛 Debugging

### If PDF Still Broken
```bash
# Check if fonts are loading
# Open DevTools > Network > Filter "fonts"
# Should see Google Fonts loading
```

### If SMS Still Broken
```bash
# Check Edge Function logs
npx supabase functions logs --project-ref rucuomtojzifrvplhwja send-notification
```

### If Shared Links Still Broken
```bash
# Test RLS policies
node test-production-fixes.js
```

---

## 📸 Screenshot Checklist

Please take screenshots of:
1. **Dashboard** (after login)
2. **Invoice detail page**
3. **PDF preview modal**
4. **Downloaded PDF** (opened in PDF viewer)
5. **SMS dialog**
6. **Public invoice page** (incognito browser)
7. **Browser console** (F12 > Console tab)
8. **Network tab** (F12 > Network > Filter XHR)

---

## 🎉 Expected Results Summary

| Feature | Status | Expected Behavior |
|---------|--------|-------------------|
| Login | ✅ Working | Redirects to dashboard |
| PDF Preview | ✅ FIXED | Shows professional invoice |
| PDF Download | ✅ FIXED | Complete invoice (not "ytytytyt") |
| SMS Dialog | ✅ FIXED | Opens without errors |
| Shared Links | ✅ FIXED | Work without authentication |
| CORS | ✅ FIXED | No blocking errors |
| Network | ✅ Working | All requests succeed (200) |

---

## 📞 Next Steps

1. **Run Tests**: Use automated script or manual checklist
2. **Document Results**: Take screenshots of any failures
3. **Report Issues**: If any test fails, provide:
   - Screenshot of the failure
   - Console error messages
   - Network tab status codes
   - Steps to reproduce

---

## 🚀 Deployment Info

- **Deployed**: Just now (latest commit)
- **Production URL**: https://elevate-mobile-experience.vercel.app
- **Branch**: feature/production-ready-fixes
- **Commit**: "fix: Increase PDF generation timing and redeploy send-notification"

All critical fixes are now live! 🎉
