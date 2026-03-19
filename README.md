# TradieMate

> Mobile-first business management platform for trade professionals — invoicing, quoting, job tracking, and voice-powered workflows with native iOS & Android support.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)

---

## Features

- **Voice Command Workflow** — Create invoices, quotes, and jobs hands-free via natural language voice processing
- **Invoicing & Quoting** — Generate, send, and track professional invoices and quotes with PDF generation
- **Recurring Invoices** — Automated recurring invoice generation with customizable schedules
- **Job Management** — Full job lifecycle tracking from creation through completion
- **Client Management** — Centralized client database with contact details and job history
- **Subcontractor Management** — Track and manage subcontractor relationships
- **Timesheet Tracking** — Log hours against jobs with detailed timesheet reports
- **BAS Reporting** — Business Activity Statement report generation for tax compliance
- **Payment Processing** — Stripe Connect integration for direct payment collection
- **Accounting Integrations** — Sync with MYOB, QuickBooks, and Xero
- **Team Collaboration** — Multi-user team support with invitation system
- **Subscription Billing** — Tiered plans with usage limits via RevenueCat
- **Push Notifications** — Real-time notifications and payment reminders
- **Offline Support** — IndexedDB-backed offline capability with background sync
- **Native Mobile** — Full iOS and Android builds via Capacitor with secure HTTPS enforcement

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Radix UI, shadcn/ui |
| Mobile | Capacitor 8 (iOS + Android) |
| Backend | Supabase (Auth, Database, Edge Functions, Storage) |
| Payments | Stripe Connect, RevenueCat |
| Accounting | MYOB, QuickBooks, Xero OAuth integrations |
| PDF | Server-side PDF generation via Edge Functions |
| Testing | Vitest (unit), Playwright (e2e) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- Supabase CLI (for local development)
- Android Studio / Xcode (for native builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/mhmalvi/elevate-mobile-experience.git
cd elevate-mobile-experience

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase, Stripe, and integration credentials

# Start development server
npm run dev
```

### Native Builds

```bash
# Android
npx cap sync android
npx cap open android

# iOS
npx cap sync ios
npx cap open ios
```

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Full test suite (unit + e2e + integration)
npm run test:full
```

## Project Structure

```
├── src/
│   ├── components/       # UI components (forms, invoices, jobs, layout)
│   ├── hooks/            # React hooks (auth, profile, team, usage limits)
│   ├── pages/            # Route pages (Dashboard, Invoices, Jobs, Quotes, etc.)
│   ├── integrations/     # Supabase client configuration
│   └── lib/              # Shared utilities
├── supabase/
│   └── functions/        # 30+ Edge Functions (payments, PDF, voice, sync)
├── android/              # Capacitor Android project
├── ios/                  # Capacitor iOS project
├── e2e/                  # Playwright end-to-end tests
└── scripts/              # Build, deploy, and integration test scripts
```

## Environment Variables

Refer to `.env.example` for the complete list of required configuration values, including:

- Supabase project URL and keys
- Stripe secret and webhook keys
- MYOB, QuickBooks, and Xero OAuth credentials
- Encryption key for token storage

## License

This project is proprietary software. All rights reserved.
