# TradieMate Testing Guide

## Quick Start Testing Options

### 1. Web Browser Testing (Fastest - No Build Required)

**Local Development:**
```bash
npm run dev
```
- Open: http://localhost:8080
- Test all features in Chrome/Edge with mobile device emulation
- Open DevTools (F12) → Toggle device toolbar (Ctrl+Shift+M)
- Select iPhone or Android device profile

**Features to Test:**
- ✅ Create account / Login
- ✅ Complete onboarding flow
- ✅ Create client
- ✅ Create quote → Send to client
- ✅ Create job → Update status
- ✅ Create invoice → Send to client
- ✅ Test offline mode (DevTools → Network → Offline)
- ✅ PDF generation and preview
- ✅ Custom branding settings

---

### 2. PWA Testing on Physical Device (Recommended)

**Deploy to Free Hosting:**

**Option A: Netlify (Recommended)**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the app
npm run build

# Deploy (first time - creates new site)
netlify deploy --prod

# Follow prompts:
# - Authorize Netlify
# - Publish directory: dist
# - Copy the URL provided
```

**Option B: Vercel**
```bash
# Install Vercel CLI
npm install -g vercel

# Build and deploy
npm run build
vercel --prod
```

**Option C: Cloudflare Pages**
```bash
# Install Wrangler
npm install -g wrangler

# Build
npm run build

# Deploy
npx wrangler pages deploy dist --project-name tradiemate
```

**Then on Your Phone:**

**iOS (Safari):**
1. Open Safari → Go to your deployed URL
2. Tap Share button (□↑)
3. Scroll down → Tap "Add to Home Screen"
4. Name it "TradieMate" → Tap "Add"
5. App icon appears on home screen!

**Android (Chrome):**
1. Open Chrome → Go to your deployed URL
2. Tap menu (⋮) → "Add to Home Screen"
3. Or wait for "Install" banner at bottom
4. App installs like a native app!

**PWA Features to Test:**
- ✅ Offline mode (turn on airplane mode)
- ✅ Push notifications (if implemented)
- ✅ Home screen icon and splash screen
- ✅ Full-screen experience
- ✅ Camera access (for photo uploads)
- ✅ Location access (for job addresses)

---

### 3. Local Network Testing (No Deployment Needed)

**Test on phone using your local network:**

```bash
# 1. Start dev server
npm run dev

# 2. Find your local IP address:
# Windows:
ipconfig
# Look for "IPv4 Address" (e.g., 192.168.1.100)

# Mac/Linux:
ifconfig | grep "inet "
# Look for local IP (e.g., 192.168.1.100)

# 3. Update vite.config.ts temporarily:
```

Update `vite.config.ts`:
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",  // Allow external access
    port: 8080,
  },
  // ... rest of config
}));
```

Then on your phone (must be on same WiFi):
- Open browser → Go to `http://YOUR_IP:8080`
- Example: `http://192.168.1.100:8080`

**For HTTPS (Required for some features):**

Use ngrok:
```bash
# Install ngrok: https://ngrok.com/download
# Or: npm install -g ngrok

# Start your dev server
npm run dev

# In another terminal:
ngrok http 8080

# Use the HTTPS URL provided (e.g., https://abc123.ngrok.io)
```

---

### 4. iOS Native App Testing (Requires Mac + Xcode)

**Prerequisites:**
- Mac computer
- Xcode 15+ installed
- Apple ID
- iPhone with USB cable

**Build Steps:**
```bash
# 1. Build web assets
npm run build

# 2. Sync with iOS
npx cap sync ios

# 3. Open Xcode
npx cap open ios
```

**In Xcode:**
1. Select your iPhone from device dropdown (top)
2. Go to Signing & Capabilities
3. Select your Team (Apple ID)
4. Click Play (▶) to build and run on your device

**First Time Setup:**
- Xcode will ask to register your device
- On iPhone: Settings → General → VPN & Device Management
- Trust your developer certificate

**Features to Test:**
- ✅ Native camera integration
- ✅ Push notifications
- ✅ Biometric authentication (Face ID/Touch ID)
- ✅ Background sync
- ✅ Secure storage (Keychain)
- ✅ App lifecycle (background/foreground)

---

### 5. Android Native App Testing

**Prerequisites:**
- Android Studio installed
- Android device with USB cable
- Enable Developer Mode on phone

**Build Steps:**
```bash
# 1. Build web assets
npm run build

# 2. Sync with Android
npx cap sync android

# 3. Open Android Studio
npx cap open android
```

**In Android Studio:**
1. Connect phone via USB
2. Enable USB debugging on phone:
   - Settings → About phone → Tap "Build number" 7 times
   - Settings → Developer options → Enable "USB debugging"
3. Select your device from dropdown
4. Click Run (▶)

**Alternative: Build APK for Manual Install**
```bash
# In Android Studio:
# Build → Build Bundle(s) / APK(s) → Build APK(s)

# Then install on device:
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

### 6. iOS Simulator Testing (Mac Only - No Physical Device)

```bash
# Build and sync
npm run build
npx cap sync ios

# List available simulators
xcrun simctl list devices

# Open iOS simulator
npx cap run ios

# Or specify device:
npx cap run ios --target="iPhone 15 Pro"
```

---

### 7. Android Emulator Testing (No Physical Device)

**Setup Android Emulator:**
1. Open Android Studio
2. Tools → Device Manager
3. Create Virtual Device
4. Select device (e.g., Pixel 7)
5. Download system image (Android 13+)
6. Finish and start emulator

**Run App:**
```bash
npm run build
npx cap sync android
npx cap run android
```

---

## Comprehensive Testing Checklist

### Core Features
- [ ] **Authentication**
  - [ ] Sign up with email
  - [ ] Email verification
  - [ ] Login
  - [ ] Password reset
  - [ ] Logout

- [ ] **Onboarding**
  - [ ] Complete business profile
  - [ ] Set up bank details
  - [ ] Choose subscription tier

- [ ] **Clients**
  - [ ] Create new client
  - [ ] Edit client details
  - [ ] View client history
  - [ ] Delete client (soft delete)

- [ ] **Quotes**
  - [ ] Create quote with line items
  - [ ] Add custom branding
  - [ ] Preview PDF
  - [ ] Download PDF
  - [ ] Send via email
  - [ ] Send via SMS
  - [ ] View quote publicly (client view)
  - [ ] Convert to job

- [ ] **Jobs**
  - [ ] Create job from quote
  - [ ] Update job status
  - [ ] Track job progress
  - [ ] Convert to invoice

- [ ] **Invoices**
  - [ ] Create invoice
  - [ ] Add payment terms
  - [ ] Send to client
  - [ ] Mark as paid
  - [ ] View payment history
  - [ ] Client payment page (Stripe)

### Advanced Features
- [ ] **Offline Mode**
  - [ ] Turn on airplane mode
  - [ ] Create clients/quotes/jobs offline
  - [ ] Verify data encrypted in IndexedDB
  - [ ] Go online → Verify sync
  - [ ] Check conflict resolution

- [ ] **Payments**
  - [ ] Test subscription checkout (Stripe)
  - [ ] Test client payment flow
  - [ ] Verify Stripe Connect setup
  - [ ] Check payment webhooks

- [ ] **Branding**
  - [ ] Upload logo
  - [ ] Set custom colors
  - [ ] Preview branded documents
  - [ ] Update email templates

- [ ] **Xero Integration**
  - [ ] Connect Xero account
  - [ ] Sync clients
  - [ ] Sync invoices
  - [ ] Verify token encryption

- [ ] **Team Features**
  - [ ] Create team
  - [ ] Invite team member
  - [ ] Test role permissions
  - [ ] Accept invitation

### Mobile-Specific
- [ ] **Camera**
  - [ ] Upload client photo
  - [ ] Upload logo
  - [ ] Take job site photos

- [ ] **Notifications**
  - [ ] Push notifications (native apps)
  - [ ] Email notifications
  - [ ] SMS notifications

- [ ] **Performance**
  - [ ] App load time < 3 seconds
  - [ ] Smooth scrolling
  - [ ] No layout shifts
  - [ ] Fast navigation

### Security
- [ ] **Data Protection**
  - [ ] Verify encrypted storage
  - [ ] Check RLS policies
  - [ ] Test unauthorized access
  - [ ] Verify token security

- [ ] **Privacy**
  - [ ] No console logs in production
  - [ ] No exposed API keys
  - [ ] Secure HTTPS only
  - [ ] Cookie policy (if using)

---

## Testing Tools

### Browser DevTools
```javascript
// Test offline mode in console:
// 1. Open DevTools (F12)
// 2. Application → Service Workers → Offline checkbox
// 3. OR Network → Throttling → Offline

// Check IndexedDB encryption:
// Application → IndexedDB → offline-db → clients
// Verify fields like email/phone are encrypted (look like random strings)

// Monitor network requests:
// Network tab → Filter by "fetch/xhr"
// Verify all API calls use HTTPS
```

### Useful Commands
```bash
# Clear all caches
rm -rf node_modules/.vite
rm -rf dist

# Fresh build
npm run build

# Check bundle size
npm run build -- --mode production
# Look for large chunks to optimize

# Test production build locally
npm run preview
```

---

## Performance Testing

### Lighthouse (Chrome DevTools)
```bash
# 1. Build production version
npm run build
npm run preview

# 2. Open Chrome DevTools
# 3. Lighthouse tab → Mobile → Run audit

# Target Scores:
# - Performance: 90+
# - Accessibility: 90+
# - Best Practices: 95+
# - SEO: 90+
# - PWA: 100
```

### Mobile Network Testing
Test on different connection speeds:
- DevTools → Network → Throttling
- Options: Fast 3G, Slow 3G, Offline

---

## Debugging Tips

### Common Issues

**1. App won't load:**
```bash
# Clear all caches
rm -rf node_modules/.vite dist
npm install
npm run build
```

**2. API calls failing:**
- Check `.env` variables are loaded
- Verify Supabase project is active
- Check edge functions are deployed
- Review browser console for CORS errors

**3. Offline sync not working:**
- Check Service Worker is registered
- Verify IndexedDB has data
- Check sync queue in DevTools

**4. PDF not generating:**
- Check DOMPurify is installed
- Verify html2canvas and jsPDF are loaded
- Check console for errors

**5. Payments not working:**
- Verify Stripe keys (test vs production)
- Check webhook endpoints
- Review Stripe dashboard logs

---

## Quick Test Script

Run this in your browser console to test core features:
```javascript
// Test authentication
console.log("Auth user:", await supabase.auth.getUser());

// Test database connection
console.log("Clients:", await supabase.from('clients').select('*').limit(5));

// Test offline storage
console.log("IndexedDB:", await indexedDB.databases());

// Test encryption key
console.log("Encryption configured:", !!localStorage.getItem('encryption_key'));
```

---

## Reporting Issues

When testing, document:
1. **Device:** iPhone 15 Pro / Pixel 7 / Chrome Desktop
2. **OS Version:** iOS 17.2 / Android 14 / Windows 11
3. **Steps to reproduce**
4. **Expected behavior**
5. **Actual behavior**
6. **Screenshots/videos**
7. **Console errors** (F12 → Console tab)

---

## Production Checklist Before Launch

- [ ] All tests passing
- [ ] No console errors
- [ ] Lighthouse score > 90
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome
- [ ] Tested offline mode
- [ ] Tested payment flow end-to-end
- [ ] Privacy policy added
- [ ] Terms of service added
- [ ] Contact/support email working
- [ ] Error tracking configured (Sentry/LogRocket)
- [ ] Analytics configured (if using)
- [ ] Backup strategy in place
- [ ] Monitoring alerts set up

---

**Ready to test? Start with Option 1 (Web Browser) and progress to Option 2 (PWA) for the most realistic mobile experience!**
