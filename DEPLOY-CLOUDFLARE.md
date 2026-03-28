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
