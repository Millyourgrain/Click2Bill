// Firebase Configuration for Vite
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();

if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
  throw new Error(
    'Firebase env missing. For dev use .env; for production builds use .env.production or set VITE_FIREBASE_* on your host before npm run build.'
  );
}

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