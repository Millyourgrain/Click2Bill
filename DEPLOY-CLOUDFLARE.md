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

## Online card payments (Stripe Checkout)

Click2Bill does not collect, store, or transmit card numbers. When a company turns on **Online card payment**, the customer is sent to **Stripe-hosted Checkout**. Stripe settles the card payment. This worker creates the Checkout Session from the invoice total in Firestore and, when Stripe sends a signed `checkout.session.completed` event with `payment_status` `paid`, marks that invoice paid (`paymentMethod` `card`).

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
