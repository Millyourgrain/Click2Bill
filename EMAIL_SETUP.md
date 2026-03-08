# Email Setup (Cloudflare Worker + Resend)

This app sends emails (signup links, invoices, appointment/visit notifications) through the platform instead of mailto links.

## Prerequisites

1. **Resend account** (free): https://resend.com
   - Sign up and get your API key from the dashboard
   - Free tier: 100 emails/day, 3,000/month

2. **Firebase API key** (you already have this in `.env.production`)

## Cloudflare Configuration

### 1. Add environment variables

In **Cloudflare Dashboard** → **Workers & Pages** → **clicktobill** → **Settings** → **Variables and Secrets**:

| Variable | Type | Value |
|----------|------|-------|
| `FIREBASE_API_KEY` | Variable | Same as your `VITE_FIREBASE_API_KEY` (for token verification) |
| `RESEND_API_KEY` | Secret | Your Resend API key |

To set the secret via CLI:
```bash
npx wrangler secret put RESEND_API_KEY
```
Then paste your Resend API key when prompted.

### 2. Optional: Custom "From" address

By default, emails are sent from `ClickToBill <onboarding@resend.dev>` (Resend's free sender).

To use your own domain, add a variable:
- `FROM_EMAIL` = `Your Company <noreply@yourdomain.com>`

You must verify your domain in Resend first.

## Deploy

After adding the variables, deploy as usual:
```bash
npm run build
npx wrangler deploy
```

## Local development

To test email sending locally:

1. Terminal 1: `npm run dev` (Vite on port 5173)
2. Terminal 2: `npx wrangler dev` (Worker on port 8787)

The app will call `http://localhost:8787/api/send-email` when in dev mode.

## What sends emails

- **CustomerList** → "Send sign-up link" – sends signup invitation to customer/payor
- **InvoiceGenerator** → "Email" delivery – sends invoice to customer/payor
- **ServiceSchedule** → When worker creates a visit – notifies customer and payor
- **CustomerDashboard** → When customer adds appointment – confirms to customer and notifies provider
