// Firebase Configuration for Vite
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const envMap = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

const missing = Object.entries(envMap)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  throw new Error(
    `Firebase env missing (${missing.join(', ')}). ` +
      'Vite bakes these in at build time — they are not read from Cloudflare at runtime. ' +
      'Local: add a .env (npm run dev) or .env.production (npm run build); copy from .env.example. ' +
      'GitHub → Cloudflare: set matching repository Actions secrets (see .github/workflows/deploy-cloudflare.yml).'
  );
}

const [apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId] = [
  envMap.VITE_FIREBASE_API_KEY,
  envMap.VITE_FIREBASE_AUTH_DOMAIN,
  envMap.VITE_FIREBASE_PROJECT_ID,
  envMap.VITE_FIREBASE_STORAGE_BUCKET,
  envMap.VITE_FIREBASE_MESSAGING_SENDER_ID,
  envMap.VITE_FIREBASE_APP_ID,
];

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;