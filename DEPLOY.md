# Deployment Guide: Vercel + Firebase

## ✅ Code pushed to GitHub

Repository: **https://github.com/amitvirkar1988-dot/Digital_invoice**

---

## Step 1: Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in (use **GitHub**).

2. Click **Add New** → **Project**.

3. **Import** your repository: `amitvirkar1988-dot/Digital_invoice`.

4. **Configure Project** (Vercel usually detects Vite automatically):
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **Environment Variables** – Click **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `VITE_FIREBASE_API_KEY` | Your Firebase API key |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your messaging sender ID |
   | `VITE_FIREBASE_APP_ID` | Your Firebase app ID |
   | `VITE_GEOAPIFY_API_KEY` | Your Geoapify API key (for travel/maps) |

   Get these from **Firebase Console** → Project Settings → General → Your apps.

6. Click **Deploy**.

7. After deployment, you’ll get a URL like: `https://digital-invoice-xxx.vercel.app`.

---

## Step 2: Configure Firebase for your domain

1. Go to **[Firebase Console](https://console.firebase.google.com)** → your project.

2. **Authentication** → **Settings** → **Authorized domains**:
   - Add: `digital-invoice-xxx.vercel.app` (your Vercel URL)
   - Add: `*.vercel.app` (optional, for preview deployments)

3. **Firestore** → **Rules**: Copy from `firestore.rules` and publish.

4. **Storage** → **Rules**: Copy from `storage.rules` and publish.

---

## Step 3: Test the live app

1. Open your Vercel URL.
2. Register as a worker or customer.
3. Confirm login, Firestore, and Storage work as expected.

---

## Future updates

Push changes to GitHub:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

Vercel will redeploy automatically.
