# Deploy to Cloudflare (Click2Bill)

**GitHub repo:** [https://github.com/Millyourgrain/Click2Bill](https://github.com/Millyourgrain/Click2Bill)

Use the **same Cloudflare account** you intend to own production (e.g. **Millyourgrain**). Deploying while logged into a different account sends the app to the wrong place.

---

## Option A — Workers + Wrangler (matches this repo)

This project includes **`worker.js`** + **`wrangler.toml`** (static `dist/` + `/api/send-email`).

1. Sign in to **[dash.cloudflare.com](https://dash.cloudflare.com)** as the **correct** account.
2. Locally:
   ```bash
   npx wrangler logout
   npx wrangler login
   ```
3. Set **`FIREBASE_API_KEY`** in `wrangler.toml` **or** in the dashboard: Worker **click2bill** → **Settings** → **Variables** (same value as `VITE_FIREBASE_API_KEY`).
4. Set secret: `npx wrangler secret put RESEND_API_KEY`
5. Build and deploy:
   ```bash
   npm run build
   npx wrangler deploy
   ```
6. Copy the **`*.workers.dev`** hostname from the deploy output.

**Firebase:** Authentication → **Authorized domains** → add that **exact** hostname (no `https://`).

See comments at the top of **`wrangler.toml`** for the full production checklist.

---

## Option B — Cloudflare Pages (Git connect)

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → GitHub **`Millyourgrain/Click2Bill`**.
2. Build: **`npm run build`**, output dir **`dist`**.
3. Add all **`VITE_*`** env vars from **Firebase / Geoapify** (same table as `DEPLOY.md`).
4. Deploy, then add your **`*.pages.dev`** host to Firebase **Authorized domains**.

---

## Online card payments (Helcim)

Helcim endpoints remain in the worker. **Pay now** in the app uses Stripe Connect, in the next section. The Helcim routes can open a HelcimPay.js window and mark an invoice paid (`paymentMethod` `helcim`) after Helcim approves the card.

Direct deposit (section 6a) and Interac e-Transfer (section 6b) stay as manual options. Enabling online pay is **per company**: an Authorized Signatory, Admin, or Checker turns it on in company setup section 6c. Makers cannot. No Helcim secret is stored in Firestore.

One Helcim account (the API token below) settles these card payments. Companies opt in; they do not paste their own Helcim token into Click2Bill.

Helcim accepts **CAD and USD** invoices only.

**Worker secrets:**

```bash
npx wrangler secret put HELCIM_API_TOKEN
npx wrangler secret put HELCIM_WEBHOOK_VERIFIER
```

Create the API token in Helcim under All Tools → Integrations → API Access. Turn on HelcimPay and whitelist the site origin (for example `https://click2bill.ca` and your worker host). The webhook verifier token is in Integrations → Webhooks.

**Webhook URL:** `https://<your-worker-host>/api/card-processor-webhook`

Helcim rejects webhook URLs that contain the word “Helcim”, so the path is `card-processor-webhook`. Subscribe to card transaction events. The URL must be `https`.

The browser calls `POST /api/create-helcim-session`, then opens the Helcim modal. It never receives the Helcim API token or the checkout `secretToken`.

Local secrets go in `.dev.vars` (see `dev.vars.example`).

Publish the updated `firestore.rules` so `cardCheckoutSessions` stays closed to the browser. The Worker writes that collection with the Firebase service account.

---

## Online card payments (Stripe Connect)

**Pay now** uses Stripe Connect. Each company connects its own Stripe account from company setup, section 6c. The customer pays the invoice total. Click2Bill’s application fee is **0** until a later release (`CLICK2BILL_FEE_BPS` in `workerPayments.js`; set it to `10` for 0.1%). Stripe deposits the payment, after its own card fee, to the bank account the company linked in Stripe.

The worker creates a Stripe Express account (`POST /api/stripe-connect/onboarding`) and a Checkout Session on that connected account (`POST /api/create-checkout-session`, header `Stripe-Account`). **Pay now** appears after Stripe reports both `charges_enabled` and `payouts_enabled`. The webhook `POST /api/stripe-webhook` must receive **Events on Connected accounts** for `account.updated` and `checkout.session.completed`.

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

In the Stripe Dashboard, turn on Connect, then add the webhook endpoint and enable events from connected accounts. Use the platform secret key (`sk_test_...` or `sk_live_...`). No per-company secret is stored in Click2Bill.

---

## Online card payments (Stripe Checkout)

Stripe Checkout is still in the worker (`POST /api/create-checkout-session` and `POST /api/stripe-webhook`). **Pay now** on the invoice uses Helcim, above. Stripe remains available if you point a caller at the Stripe route. When Stripe sends a signed `checkout.session.completed` event with `payment_status` `paid`, the worker marks that invoice paid (`paymentMethod` `card`).

Direct deposit (section 6a) and Interac e-Transfer (section 6b) stay as manual options. Enabling online pay is **per company**: an Authorized Signatory, Admin, or Checker turns it on in company setup. Makers cannot. No Stripe secret is stored in Firestore.

**Worker secrets** (dashboard or Wrangler — never in the browser, git, or Firestore):

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put FIREBASE_PRIVATE_KEY
```

**Worker variables** (Settings → Variables), required so the webhook can update Firestore. The Worker calls the Firestore REST API with a Google service account. `firebase-admin` is not used on Cloudflare.

| Variable | Purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase project id |
| `FIREBASE_CLIENT_EMAIL` | Service account client email |
| `FIREBASE_PRIVATE_KEY` | Service account `private_key` (PKCS8, `-----BEGIN PRIVATE KEY-----`). `\n` escapes are accepted. Set as a **secret**. |

**Webhook URL:** `https://<your-worker-host>/api/stripe-webhook`

In the Stripe Dashboard → Developers → Webhooks, send `checkout.session.completed` to that path and use the signing secret as `STRIPE_WEBHOOK_SECRET`.

No `VITE_` Stripe key is required. The browser only receives a Checkout URL from `POST /api/create-checkout-session`.

Local secrets go in `.dev.vars` (see `dev.vars.example`). Stripe CLI can forward webhooks to `http://localhost:8787/api/stripe-webhook`.

---

## Rules on Firebase

Publish **`firestore.rules`** and **`storage.rules`** from this repo (Firebase Console → Firestore / Storage → Rules).

---

## Updates

```bash
git add .
git commit -m "Your message"
git push origin main
```

(Pages will rebuild if connected; Workers need **`npm run build`** + **`npx wrangler deploy`** again for Option A.)
