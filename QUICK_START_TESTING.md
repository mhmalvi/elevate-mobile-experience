# 🚀 Quick Start Testing - TradieMate

## Fastest Way to Test (2 minutes)

### Option 1: Browser Testing (EASIEST)

```bash
# Run this script:
quick-test.bat

# OR manually:
npm run build
npm run preview
```

Then:
1. Open Chrome: **http://localhost:4173**
2. Press **F12** (DevTools)
3. Press **Ctrl+Shift+M** (Toggle device toolbar)
4. Select **iPhone 14 Pro** or **Pixel 7**
5. Start testing! ✅

**What to test:**
- Create account → Complete onboarding
- Add a client → Create a quote → Send it
- Test offline (DevTools → Network → Offline checkbox)
- Generate PDF → Preview and download

---

## Option 2: Test on Your Phone (RECOMMENDED - 5 minutes)

### Deploy to Netlify (Free & Fast):

```bash
# Install Netlify CLI (one-time)
npm install -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod
```

**Follow the prompts:**
- Authorize Netlify (opens browser)
- Publish directory: `dist`
- Copy the URL (e.g., `https://tradiemate-abc123.netlify.app`)

### Install on Your Phone:

**iPhone:**
1. Open **Safari** → Go to your Netlify URL
2. Tap **Share** (□↑) → **Add to Home Screen**
3. Name it **"TradieMate"** → **Add**
4. App icon appears! Tap to open 🎉

**Android:**
1. Open **Chrome** → Go to your Netlify URL
2. Tap **Install** banner at bottom
3. Or: Menu (⋮) → **Add to Home Screen**
4. App installs! Open from home screen 🎉

**Now test:**
- ✅ Works like a native app
- ✅ Full-screen experience
- ✅ Offline mode (turn on airplane mode!)
- ✅ Camera access (for logos/photos)
- ✅ Push notifications

---

## Option 3: Local Network Testing (NO DEPLOYMENT)

**Test on your phone using WiFi (phone and computer must be on same network):**

```bash
# 1. Build and start server
npm run build
npm run preview
```

**2. Find your IP address:**
```bash
# Windows:
ipconfig
# Look for "IPv4 Address" (e.g., 192.168.1.100)

# Mac/Linux:
ifconfig | grep "inet "
```

**3. On your phone:**
- Open browser → `http://YOUR_IP:4173`
- Example: `http://192.168.1.100:4173`

---

## Option 4: Secure HTTPS Testing (For Advanced Features)

Some features require HTTPS (camera, location, etc.). Use ngrok:

```bash
# 1. Install ngrok
# Download from: https://ngrok.com/download
# OR: npm install -g ngrok

# 2. Start your server
npm run build
npm run preview

# 3. In another terminal, run ngrok
ngrok http 4173
```

**Use the HTTPS URL provided:**
- Example: `https://abc-123-def.ngrok-free.app`
- Works on any device, anywhere!
- Has valid SSL certificate ✅

---

## Test Checklist (5 minutes)

### Core Flow:
1. **Sign up** with your email
2. **Verify email** (check inbox)
3. **Complete onboarding:**
   - Business name: "Test Plumbing"
   - ABN: "12345678901"
   - Bank details: BSB: "123-456", Account: "12345678"
   - Choose "Free" tier (for testing)

4. **Create a client:**
   - Name: "John Smith"
   - Email: "your-email@gmail.com" (use your real email!)
   - Phone: "0412345678"

5. **Create a quote:**
   - Select client: John Smith
   - Add line item: "Tap Installation - $150"
   - Preview PDF ✅
   - Send email ✅

6. **Check your email:**
   - You should receive the quote!
   - Click "View Quote" button
   - View the public quote page

7. **Test offline mode:**
   - Turn on **Airplane Mode** (or DevTools → Network → Offline)
   - Create another client: "Jane Doe"
   - Turn off airplane mode
   - Watch it sync! ✅

8. **Check encryption:**
   - F12 → Application → IndexedDB → offline-db → clients
   - Click on a client record
   - Email/phone should look encrypted (random characters)

---

## Troubleshooting

**Build fails:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Can't access from phone:**
- Make sure phone and computer on same WiFi
- Check firewall isn't blocking port 4173
- Try: `npm run dev` instead (uses port 8080)

**PWA not installing:**
- Must use HTTPS (use ngrok or deploy to Netlify)
- Check console for Service Worker errors

**API calls failing:**
- Verify `.env` file has all variables
- Check Supabase project is active
- Review edge functions are deployed

---

## Advanced Testing

### Native App Testing (Requires setup):

**iOS (Mac required):**
```bash
npm run build
npx cap sync ios
npx cap open ios
# Select your device in Xcode → Press Play
```

**Android:**
```bash
npm run build
npx cap sync android
npx cap open android
# Select your device → Press Run
```

---

## What's Next?

After basic testing works:

1. **Test Payments:**
   - Add a Stripe test card: `4242 4242 4242 4242`
   - Exp: Any future date (e.g., `12/28`)
   - CVC: Any 3 digits (e.g., `123`)

2. **Test Advanced Features:**
   - Custom branding (Settings → Branding)
   - Xero integration (Settings → Integrations)
   - Team collaboration (Settings → Team)

3. **Performance Testing:**
   - Run Lighthouse (F12 → Lighthouse → Mobile → Generate report)
   - Target: All scores above 90

4. **Ready for Production?**
   - Enable leaked password protection (Supabase Dashboard)
   - Add privacy policy and terms
   - Set up error tracking (Sentry)
   - Deploy to production hosting
   - Submit to app stores (if building native apps)

---

## Need Help?

Check the full **TESTING_GUIDE.md** for:
- Detailed testing scenarios
- Debugging tips
- Performance optimization
- Production checklist

**Happy Testing! 🎉**
