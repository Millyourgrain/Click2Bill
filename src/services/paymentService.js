/**
 * Online card payment.
 * Pay now uses Helcim (HelcimPay.js). The browser receives a checkoutToken only.
 * createCheckoutSession remains for Stripe Checkout. Card data stays with the processor.
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

async function paymentHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return headers;
}

/**
 * Ask the worker to open a HelcimPay.js session for this invoice.
 * @param {{ invoiceId: string, portalToken?: string }} args
 * @returns {Promise<{ success: boolean, checkoutToken?: string, error?: string }>}
 */
export async function createHelcimSession({ invoiceId, portalToken }) {
  try {
    const res = await fetch(`${getApiBase()}/api/create-helcim-session`, {
      method: 'POST',
      headers: await paymentHeaders(),
      body: JSON.stringify({
        invoiceId,
        ...(portalToken ? { portalToken } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.checkoutToken) {
      return { success: false, error: data.error || 'Could not start card payment' };
    }
    return { success: true, checkoutToken: data.checkoutToken };
  } catch (e) {
    console.error('createHelcimSession error:', e);
    return { success: false, error: e?.message || 'Could not start card payment' };
  }
}

/**
 * Send Helcim's transaction response to the worker. The worker checks the hash, then marks the invoice paid.
 * @param {{ invoiceId: string, portalToken?: string, checkoutToken: string, eventMessage: string }} args
 */
export async function confirmHelcimPayment({ invoiceId, portalToken, checkoutToken, eventMessage }) {
  try {
    const res = await fetch(`${getApiBase()}/api/confirm-card-payment`, {
      method: 'POST',
      headers: await paymentHeaders(),
      body: JSON.stringify({
        invoiceId,
        checkoutToken,
        eventMessage,
        ...(portalToken ? { portalToken } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.paid) {
      return { success: false, error: data.error || 'Could not confirm card payment' };
    }
    return { success: true };
  } catch (e) {
    console.error('confirmHelcimPayment error:', e);
    return { success: false, error: e?.message || 'Could not confirm card payment' };
  }
}

async function authedPost(path) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: await paymentHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Send the company to Stripe Connect onboarding. */
export async function startStripeConnect() {
  try {
    const { ok, data } = await authedPost('/api/stripe-connect/onboarding');
    if (!ok || !data.url) return { success: false, error: data.error || 'Could not open Stripe' };
    return { success: true, url: data.url };
  } catch (e) {
    console.error('startStripeConnect error:', e);
    return { success: false, error: e?.message || 'Could not open Stripe' };
  }
}

/** Read the connected account after the company returns from Stripe. */
export async function refreshStripeConnect() {
  try {
    const { ok, data } = await authedPost('/api/stripe-connect/refresh');
    if (!ok) return { success: false, error: data.error || 'Could not refresh Stripe' };
    return { success: true, ...data };
  } catch (e) {
    console.error('refreshStripeConnect error:', e);
    return { success: false, error: e?.message || 'Could not refresh Stripe' };
  }
}
