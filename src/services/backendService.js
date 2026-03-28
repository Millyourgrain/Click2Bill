import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/** Must match functions/index.js REGION */
const DEFAULT_REGION = import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1';

export function getClick2BillFunctions() {
  return getFunctions(app, DEFAULT_REGION);
}

/**
 * HTTPS function URL. Override with VITE_FUNCTIONS_HEALTH_URL if the default
 * pattern does not match your deployed function (check Firebase Console → Functions).
 */
export function getHttpFunctionUrl(functionName) {
  if (functionName === 'health' && import.meta.env.VITE_FUNCTIONS_HEALTH_URL) {
    return import.meta.env.VITE_FUNCTIONS_HEALTH_URL;
  }
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const region = DEFAULT_REGION;
  return `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
}

/** GET /health — no auth */
export async function fetchBackendHealth() {
  const url = getHttpFunctionUrl('health');
  if (!url) {
    return { ok: false, error: 'Missing VITE_FIREBASE_PROJECT_ID' };
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message || 'Request failed' };
  }
}

/** Callable — requires signed-in user */
export async function backendWhoAmI() {
  const whoami = httpsCallable(getClick2BillFunctions(), 'whoami');
  const result = await whoami();
  return result.data;
}
