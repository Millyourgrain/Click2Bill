/**
 * Start Stripe Checkout for an issued invoice.
 * The browser only receives a hosted Checkout URL. Card data stays on Stripe.
 */
import { auth } from '../firebase/config';

const getApiBase = () => {
  if (import.meta.env.DEV) return 'http://localhost:8787';
  return window.location.origin;
};

/**
 * @param {{ invoiceId: string, portalToken?: string }} args
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
export async function createCheckoutSession({ invoiceId, portalToken }) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const user = auth.currentUser;
    if (user) {
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }
    const res = await fetch(`${getApiBase()}/api/create-checkout-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        invoiceId,
        ...(portalToken ? { portalToken } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      return { success: false, error: data.error || 'Could not start card payment' };
    }
    return { success: true, url: data.url };
  } catch (e) {
    console.error('createCheckoutSession error:', e);
    return { success: false, error: e?.message || 'Could not start card payment' };
  }
}
