# Click2Bill — Email Setup Guide

## Architecture

```
Platform sends email
        │
        ▼
Cloudflare Worker (worker.js)
        │  calls Resend API
        ▼
  FROM: invoices@click2bill.ca     ← verified Resend sender
  REPLY-TO: support@click2bill.ca  ← customer replies go here
        │
        ▼
  Customer inbox
        │  customer hits "Reply"
        ▼
  support@click2bill.ca  (your domain)
        │  email forwarding rule
        ▼
  click2Bill.ca@gmail.com  (your real inbox — you respond here)
```

---

## Step 1 — Verify click2bill.ca in Resend

1. Go to [resend.com](https://resend.com) → **Domains** → **Add domain**.
2. Enter `click2bill.ca`.
3. Resend shows a set of DNS records to add. You need **all** of them:

| Type | Host / Name | Value |
|------|-------------|-------|
| TXT  | `resend._domainkey.click2bill.ca` | (Resend-provided DKIM token) |
| TXT  | `@` or `click2bill.ca` | `v=spf1 include:resend.com ~all` *(merge with existing SPF if one exists)* |
| MX   | *(if Resend lists one)* | *(Resend-provided value)* |

> Add these records in **Cloudflare DNS** (or wherever click2bill.ca is managed) → **DNS** → **Records**.  
> DNS propagation: usually under 5 minutes on Cloudflare, up to 24–48 hours elsewhere.  
> Click **Verify** in Resend until the domain shows ✅ Verified.

### DMARC (optional but recommended)

Once SPF + DKIM are passing, add this TXT record to start collecting reports:

| Type | Host | Value |
|------|------|-------|
| TXT  | `_dmarc.click2bill.ca` | `v=DMARC1; p=none; rua=mailto:click2Bill.ca@gmail.com` |

Tighten `p=` to `quarantine` or `reject` once you confirm mail flows correctly.

---

## Step 2 — Set up email forwarding for support@click2bill.ca

You need `support@click2bill.ca` to forward all mail to `click2Bill.ca@gmail.com`.

### Option A — Cloudflare Email Routing (free, recommended if DNS is on Cloudflare)

1. Cloudflare Dashboard → your `click2bill.ca` zone → **Email** → **Email Routing**.
2. Enable Email Routing (Cloudflare adds the required MX records automatically).
3. **Custom addresses** → **Create address**:
   - Address: `support`
   - Action: **Send to** → `click2Bill.ca@gmail.com`
4. Cloudflare will send a verification email to your Gmail — confirm it.
5. Repeat for `invoices@click2bill.ca` if you also want to receive any direct replies there.

> **Note:** Cloudflare Email Routing and Resend both need MX records. They use *different* MX records. Cloudflare Email Routing adds its own; Resend usually only needs TXT (DKIM/SPF). If Resend asks for an MX, check whether it conflicts — typically it does not.

### Option B — Registrar forwarding

Most domain registrars (Namecheap, Google Domains, etc.) have a free **Email Forwarding** feature under DNS settings. Create a forward from `support@click2bill.ca` → `click2Bill.ca@gmail.com`.

### Option C — Zoho Mail / Outlook free tier

Create a free mailbox at `support@click2bill.ca` and configure it to auto-forward to `click2Bill.ca@gmail.com`. This gives you a full mailbox so you can also *send from* `support@click2bill.ca` if needed.

---

## Step 3 — Configure Cloudflare Worker variables

In **Cloudflare Dashboard** → **Workers & Pages** → **click2bill** → **Settings** → **Variables and Secrets**:

| Variable | Type | Value |
|----------|------|-------|
| `FIREBASE_API_KEY` | Variable | Same as your `VITE_FIREBASE_API_KEY` |
| `RESEND_API_KEY` | **Secret** | Your Resend API key |
| `FROM_EMAIL` | Variable | `Click2Bill <invoices@click2bill.ca>` |
| `REPLY_TO_EMAIL` | Variable | `Click2Bill Support <support@click2bill.ca>` |

To set the secret via CLI:
```bash
npx wrangler secret put RESEND_API_KEY
```
Then paste your Resend API key when prompted.

> `FROM_EMAIL` and `REPLY_TO_EMAIL` are plain variables (not secrets) — they are not sensitive.

---

## Step 4 — Deploy

```bash
npm run build
npx wrangler deploy
```

---

## Step 5 — Send a test email

After deploying, send an invoice to yourself from the platform. Verify:

- [ ] The email arrives in your test inbox
- [ ] "From" shows `invoices@click2bill.ca` (not `onboarding@resend.dev`)
- [ ] Hitting "Reply" pre-fills `support@click2bill.ca`
- [ ] Sending that reply delivers it to `click2Bill.ca@gmail.com`
- [ ] Gmail SPAM score is low (check via [mail-tester.com](https://www.mail-tester.com))

---

## Local development

For `npx wrangler dev` to send real emails locally:

1. Copy `dev.vars.example` → `.dev.vars` (gitignored).
2. Fill in your actual `RESEND_API_KEY`, `FIREBASE_API_KEY`, `FROM_EMAIL`, and `REPLY_TO_EMAIL`.
3. Run in two terminals:
   ```bash
   # Terminal 1
   npm run dev          # Vite on http://localhost:5173
   # Terminal 2
   npx wrangler dev     # Worker on http://localhost:8787
   ```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "From" still shows `onboarding@resend.dev` | `FROM_EMAIL` var not set in Cloudflare or domain not verified in Resend | Verify domain in Resend first, then set the variable and redeploy |
| Resend rejects the `from` address | Domain not yet verified | Wait for DNS propagation; click Verify in Resend |
| Reply goes nowhere | Email forwarding not set up | Complete Step 2 |
| Email lands in spam | SPF/DKIM missing | Confirm all Resend DNS records are present and verified |
| `FIREBASE_API_KEY` error in Worker | Key has HTTP-referrer restriction | In Google Cloud → Credentials, remove referrer restriction for the key used by this Worker |

---

## What sends emails

| Action | Subject line |
|--------|-------------|
| Invoice emailed to customer | `Invoice #[number] from [company]` |
| Checker returns invoice to maker | `Action required: invoice #[number] needs revision` |
| Payment reminder sent | `Reminder: invoice #[number] outstanding` |
| Contested invoice re-sent | `Updated invoice #[number] from [company]` |
