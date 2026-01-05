# TradieMate

**Professional job management for Australian tradies**

TradieMate is a mobile-first Progressive Web App (PWA) designed specifically for Australian tradies to manage quotes, jobs, invoices, and clients on the go. Built with modern web technologies and optimized for mobile devices.

---

## Features

### Core Functionality
- ✅ **Client Management** - Track client details, contact information, and job history
- ✅ **Quote Creation** - Generate professional quotes with custom branding
- ✅ **Job Tracking** - Manage jobs from quote to completion
- ✅ **Invoice Generation** - Create and send invoices with PDF export
- ✅ **PDF Preview & Download** - Professional document generation
- ✅ **Email & SMS Notifications** - Send quotes and invoices directly to clients

### Advanced Features
- 📱 **Offline Mode** - Work without internet, sync when connected
- 🔒 **Encrypted Storage** - Secure local data with AES-GCM encryption
- 💳 **Payment Processing** - Stripe Connect integration for client payments
- 💰 **Subscription Management** - Cross-platform subscriptions (iOS/Android/Web)
- 🎨 **Custom Branding** - Logo, colors, and professional templates
- 📊 **Xero Integration** - Automatic accounting synchronization
- 👥 **Team Collaboration** - Multi-user access with role management
- 📈 **Usage Analytics** - Track quotes, invoices, and communication

---

## Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5
- **UI Components:** Radix UI + shadcn/ui
- **Styling:** Tailwind CSS
- **State Management:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod validation
- **Routing:** React Router DOM v6

### Backend
- **Database:** Supabase (PostgreSQL 17)
- **Authentication:** Supabase Auth
- **Edge Functions:** Deno (23 serverless functions)
- **Storage:** Supabase Storage + IndexedDB (offline)

### Mobile
- **Platform:** Capacitor 8 (iOS + Android)
- **PWA:** Service Worker + Web App Manifest

### Integrations
- **Payments:** Stripe + RevenueCat
- **Email:** Resend
- **SMS:** Twilio
- **Accounting:** Xero OAuth 2.0
- **PDF Generation:** jsPDF + html2canvas

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Stripe account (for payments)
- Optional: Twilio (SMS), Resend (email), Xero (accounting)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd elevate-mobile-experience
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   ```env
   # Supabase
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Stripe
   STRIPE_SECRET_KEY=your_stripe_key
   VITE_STRIPE_PRICE_ID_SOLO=price_xxx
   VITE_STRIPE_PRICE_ID_CREW=price_xxx
   VITE_STRIPE_PRICE_ID_PRO=price_xxx

   # RevenueCat
   VITE_REVENUECAT_ANDROID_API_KEY=sk_xxx
   VITE_REVENUECAT_IOS_API_KEY=sk_xxx
   VITE_REVENUECAT_WEB_API_KEY=sk_xxx
   ```

4. **Set up Supabase**

   Link your project:
   ```bash
   npx supabase link --project-ref your-project-id
   ```

   Apply migrations:
   ```bash
   npx supabase db push
   ```

   Deploy edge functions:
   ```bash
   export SUPABASE_ACCESS_TOKEN=your_access_token
   npx supabase functions deploy
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

   App will be available at `http://localhost:8080`

### Building for Production

**Web Build:**
```bash
npm run build
```

**iOS Build:**
```bash
npm run build
npx cap sync ios
npx cap open ios
```

**Android Build:**
```bash
npm run build
npx cap sync android
npx cap open android
```

---

## Project Structure

```
elevate-mobile-experience/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── forms/          # Form components
│   │   └── layout/         # Layout components
│   ├── pages/              # Route pages
│   │   └── settings/       # Settings pages
│   ├── hooks/              # Custom React hooks
│   │   └── queries/        # React Query hooks
│   ├── lib/                # Utility libraries
│   │   ├── offline/        # Offline mode implementation
│   │   └── validation.ts   # Form validation schemas
│   └── integrations/       # Third-party integrations
│       └── supabase/       # Supabase client & types
├── supabase/
│   ├── functions/          # Edge Functions (23 total)
│   │   ├── _shared/        # Shared utilities
│   │   ├── generate-pdf/   # PDF generation
│   │   ├── send-email/     # Email sending
│   │   ├── send-notification/ # SMS/Email notifications
│   │   ├── stripe-webhook/ # Stripe webhook handler
│   │   └── xero-*/         # Xero integration
│   └── migrations/         # Database migrations (37 total)
├── ios-config/             # iOS build configuration
├── ios-resources/          # iOS app resources
└── public/                 # Static assets
```

---

## Database Schema

### Core Tables
- **profiles** - User profiles and business settings
- **clients** - Client contact information
- **quotes** - Quote documents with line items
- **jobs** - Job tracking and scheduling
- **invoices** - Invoice documents with line items
- **teams** - Team collaboration
- **team_members** - Team membership and roles
- **branding_settings** - Custom branding configuration
- **usage_tracking** - Monthly usage limits

### Features
- Row-Level Security (RLS) on all tables
- Soft deletes with `deleted_at` column
- Team-scoped data isolation
- Encrypted sensitive fields (bank details, Xero tokens)

---

## Subscription Tiers

| Tier | Price | Quotes | Invoices | Jobs | SMS | Emails | Clients |
|------|-------|--------|----------|------|-----|--------|---------|
| **Free** | $0 | 5 | 5 | 10 | 5 | 10 | 10 |
| **Solo** | $29/mo | 50 | 50 | 100 | 25 | 50 | 100 |
| **Crew** | $49/mo | ∞ | ∞ | ∞ | 100 | ∞ | ∞ |
| **Pro** | $79/mo | ∞ | ∞ | ∞ | ∞ | ∞ | ∞ |

---

## Security Features

- 🔐 **Authentication** - Supabase Auth with email verification
- 🔒 **Encryption** - AES-GCM for sensitive data at rest
- 🛡️ **XSS Protection** - DOMPurify sanitization
- 🔑 **Secure Storage** - Platform-specific encrypted storage (Keychain/EncryptedSharedPreferences)
- ✅ **RLS Policies** - Row-level security on all database tables
- 🔏 **OAuth Security** - PKCE for Xero integration
- 📝 **Webhook Verification** - Stripe signature verification + idempotency
- 🚫 **CORS Protection** - Strict origin checking

---

## API Documentation

### Edge Functions

All edge functions are deployed at:
```
https://[project-ref].supabase.co/functions/v1/[function-name]
```

**Key Functions:**
- `generate-pdf` - Generate PDF from quote/invoice
- `send-email` - Send professional emails via Resend
- `send-notification` - Send SMS/Email notifications
- `stripe-webhook` - Handle Stripe payment events
- `create-stripe-connect` - Onboard tradies to receive payments
- `xero-oauth` - Xero OAuth 2.0 flow
- `xero-sync-*` - Sync data with Xero

---

## Troubleshooting

### Common Issues

**Build Errors:**
- Clear node_modules: `rm -rf node_modules package-lock.json && npm install`
- Clear Vite cache: `rm -rf .vite`

**Supabase Connection:**
- Verify environment variables are set correctly
- Check Supabase project status
- Ensure edge functions are deployed

**Mobile Build Issues:**
- Sync Capacitor: `npx cap sync`
- Clean builds in Xcode/Android Studio
- Verify capacitor.config.json

**Email Not Sending:**
- Verify Resend API key
- Check custom domain verification in Resend dashboard
- Review edge function logs

---

## License

Proprietary - All Rights Reserved

---

## Support

For support and questions:
- Email: support@tradiemate.com.au
- Website: https://tradiemate.com.au

---

**Built with ❤️ for Australian tradies**
