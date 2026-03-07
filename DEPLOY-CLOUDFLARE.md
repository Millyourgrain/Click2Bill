# Deploy to Cloudflare Pages (Free)

## Prerequisites

- Code pushed to GitHub: **https://github.com/amitvirkar1988-dot/Digital_invoice**
- Firebase project set up (for database, auth, storage)

---

## Step 1: Create Cloudflare account

1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)** and sign up (free).
2. Or sign in with **GitHub** for easier repo connection.

---

## Step 2: Create a Pages project

1. In the Cloudflare dashboard, go to **Workers & Pages** (left sidebar).
2. Click **Create** → **Pages** → **Connect to Git**.
3. Click **Connect Git** and authorize **GitHub**.
4. Select your repository: **amitvirkar1988-dot/Digital_invoice**.
5. Click **Begin setup**.

---

## Step 3: Configure build settings

Use these values:

| Setting | Value |
|---------|-------|
| **Production branch** | `main` |
| **Framework preset** | None (or Vite if listed) |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

---

## Step 4: Add environment variables

1. Expand **Environment variables (advanced)**.
2. Add each variable (for **Production** and **Preview** if you want):

| Variable name | Value |
|---------------|-------|
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `VITE_FIREBASE_APP_ID` | Your Firebase app ID |
| `VITE_GEOAPIFY_API_KEY` | Your Geoapify API key |

Get these from **Firebase Console** → Project Settings (gear) → General → Your apps.

---

## Step 5: Deploy

1. Click **Save and Deploy**.
2. Cloudflare will build and deploy your app (usually 1–3 minutes).
3. Your site will be at: `https://digital-invoice.pages.dev` (or a similar URL).

---

## Step 6: Configure Firebase for your domain

1. Go to **[Firebase Console](https://console.firebase.google.com)** → your project.
2. **Authentication** → **Settings** → **Authorized domains**.
3. Click **Add domain** and add:
   - `digital-invoice.pages.dev` (or your actual Cloudflare Pages URL)
   - `*.pages.dev` (optional, for preview deployments)

---

## Step 7: Publish Firestore & Storage rules

1. **Firestore** → **Rules** → paste contents of `firestore.rules` → **Publish**.
2. **Storage** → **Rules** → paste contents of `storage.rules` → **Publish**.

---

## Future updates

Push to GitHub and Cloudflare will redeploy automatically:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

---

## Custom domain (optional)

1. In Cloudflare Pages → your project → **Custom domains**.
2. Click **Set up a custom domain**.
3. Enter your domain (e.g. `yourapp.com`) and follow the DNS setup steps.
