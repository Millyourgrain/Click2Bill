/**
 * Stripe Checkout + Firestore for the Cloudflare Worker.
 * Uses fetch only (Stripe REST + Firestore REST + Google OAuth). firebase-admin and the
 * Node Stripe SDK are not used here — they depend on Node built-ins that do not run on Workers.
 * Card numbers never touch this worker. Secrets stay in env.
 */
const FIREBASE_LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const STRIPE_API = 'https://api.stripe.com/v1';
const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

export const PAYABLE_STATUSES = new Set(['sent', 'viewed', 'accepted', 'overdue']);
/** Click2Bill invoicing fee in basis points. 0 until a later release; 10 = 0.1%. */
const CLICK2BILL_FEE_BPS = 0;
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

let tokenCache = { accessToken: '', expiresAt: 0 };

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function isSafeDocId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

function base64UrlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizePrivateKey(raw) {
  let key = String(raw || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

function pemToPkcs8(pem) {
  const b64 = normalizePrivateKey(pem)
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signServiceAccountJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: DATASTORE_SCOPE,
  })));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(env.FIREBASE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

export function firestoreConfigured(env) {
  return !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

export async function getGoogleAccessToken(env) {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60_000) return tokenCache.accessToken;
  const assertion = await signServiceAccountJwt(env);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    console.error('Google token exchange failed', res.status);
    throw new Error('Firestore auth failed');
  }
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
  };
  return data.access_token;
}

function firestoreDocUrl(env, collectionName, docId) {
  const project = encodeURIComponent(env.FIREBASE_PROJECT_ID);
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collectionName}/${docId}`;
}

function unwrapFirestoreValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) {
    const out = {};
    const fields = v.mapValue.fields || {};
    for (const [k, val] of Object.entries(fields)) out[k] = unwrapFirestoreValue(val);
    return out;
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrapFirestoreValue);
  return null;
}

export function unwrapDoc(doc) {
  const out = {};
  const fields = doc?.fields || {};
  for (const [k, val] of Object.entries(fields)) out[k] = unwrapFirestoreValue(val);
  return out;
}

export async function getFirestoreDoc(env, collectionName, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(firestoreDocUrl(env, collectionName, docId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error('Firestore read failed', collectionName, res.status);
    throw new Error('Firestore read failed');
  }
  return unwrapDoc(await res.json());
}

export async function patchFirestoreDoc(env, collectionName, docId, fields) {
  const token = await getGoogleAccessToken(env);
  const url = new URL(firestoreDocUrl(env, collectionName, docId));
  for (const name of Object.keys(fields)) url.searchParams.append('updateMask.fieldPaths', name);
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    console.error('Firestore patch failed', collectionName, res.status);
    throw new Error('Firestore patch failed');
  }
}

export async function deleteFirestoreDoc(env, collectionName, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(firestoreDocUrl(env, collectionName, docId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    console.error('Firestore delete failed', collectionName, res.status);
    throw new Error('Firestore delete failed');
  }
}

function click2BillFeeMinor(amountMinor) {
  const fee = Math.round(amountMinor * CLICK2BILL_FEE_BPS / 10000);
  if (!Number.isSafeInteger(fee) || fee < 1 || fee >= amountMinor) return 0;
  return fee;
}

function minorUnits(total, currency) {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return null;
  const code = currency.toLowerCase();
  const minor = ZERO_DECIMAL.has(code) ? Math.round(n) : Math.round(n * 100);
  if (!Number.isSafeInteger(minor) || minor < 1) return null;
  return minor;
}

export function allowedAppOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol === 'http:' && !local) return '';
  const workerHost = new URL(request.url).host;
  if (local || parsed.host === workerHost) return parsed.origin;
  return '';
}

export async function lookupFirebaseUser(idToken, apiKey) {
  if (!idToken || !apiKey || String(apiKey).includes('PASTE_YOUR')) return null;
  const res = await fetch(`${FIREBASE_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    console.error('Firebase accounts:lookup failed', res.status);
    return null;
  }
  const data = await res.json().catch(() => ({}));
  const user = data.users && data.users[0];
  if (!user?.localId) return null;
  return user;
}

export async function authorizePayer(request, env, invoice, portalToken) {
  const supplied = typeof portalToken === 'string' ? portalToken.trim() : '';
  if (supplied) {
    const expected = typeof invoice.portalToken === 'string' ? invoice.portalToken : '';
    if (supplied.length < 16 || supplied.length > 200 || supplied !== expected) {
      return { ok: false, status: 403, error: 'Invalid or expired link' };
    }
    return { ok: true, via: 'portal' };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    return { ok: false, status: 401, error: 'Missing Authorization token or portal token' };
  }
  const user = await lookupFirebaseUser(idToken, env.FIREBASE_API_KEY);
  if (!user) return { ok: false, status: 401, error: 'Invalid or expired token' };

  const email = String(user.email || '').toLowerCase();
  const customerEmail = String(invoice.customerEmail || '').toLowerCase();
  const payorEmail = String(invoice.payorEmail || '').toLowerCase();
  if (email && (email === customerEmail || email === payorEmail)) return { ok: true, via: 'account' };

  if (user.localId === invoice.userId) return { ok: true, via: 'account' };
  if (isSafeDocId(user.localId)) {
    const profile = await getFirestoreDoc(env, 'users', user.localId);
    if (profile && profile.organizationOwnerId === invoice.userId) return { ok: true, via: 'account' };
  }
  return { ok: false, status: 403, error: 'You cannot pay this invoice' };
}

function stripeHeaders(env, stripeAccount, contentType) {
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  if (contentType) headers['Content-Type'] = contentType;
  if (stripeAccount) headers['Stripe-Account'] = stripeAccount;
  return headers;
}

async function stripeForm(env, path, params, stripeAccount) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: stripeHeaders(env, stripeAccount, 'application/x-www-form-urlencoded'),
    body: params instanceof URLSearchParams ? params : new URLSearchParams(params || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function stripeGet(env, path, stripeAccount) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: stripeHeaders(env, stripeAccount),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** The company profile saved this Stripe account when Connect finished. */
function connectedAccountCanCharge(company) {
  const stripeAccount = typeof company?.stripeConnectedAccountId === 'string' ? company.stripeConnectedAccountId.trim() : '';
  if (!/^acct_[A-Za-z0-9]+$/.test(stripeAccount)) return { ok: false, stripeAccount: '' };
  return { ok: true, stripeAccount };
}

export async function syncStripeConnectedAccount(env, account) {
  const companyId = account?.metadata?.click2billCompanyId;
  if (!isSafeDocId(companyId) || !/^acct_[A-Za-z0-9]+$/.test(account?.id || '')) return false;
  const charges = account.charges_enabled === true;
  const payouts = account.payouts_enabled === true;
  const now = new Date().toISOString();
  await patchFirestoreDoc(env, 'companies', companyId, {
    stripeConnectedAccountId: { stringValue: account.id },
    stripeChargesEnabled: { booleanValue: charges },
    stripePayoutsEnabled: { booleanValue: payouts },
    stripeDetailsSubmitted: { booleanValue: account.details_submitted === true },
    onlineCardPaymentEnabled: { booleanValue: charges && payouts },
    updatedAt: { stringValue: now },
  });
  return true;
}

function returnUrls(origin, invoiceId, invoice, via) {
  if (via === 'portal') {
    const token = encodeURIComponent(invoice.portalToken);
    const base = `${origin}/invoice/view/${invoiceId}?t=${token}`;
    return { successUrl: `${base}&paid=1`, cancelUrl: base };
  }
  const base = `${origin}/customer/invoice/${invoiceId}`;
  return { successUrl: `${base}?paid=1`, cancelUrl: base };
}

export async function handleCardPayAvailable(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const invoiceId = payload?.invoiceId;
  if (!isSafeDocId(invoiceId)) return json({ error: 'Invalid invoice' }, 400);
  if (!env.STRIPE_SECRET_KEY || !firestoreConfigured(env)) {
    return json({ error: 'Online card payment is not configured.' }, 500);
  }

  let invoice;
  try {
    invoice = await getFirestoreDoc(env, 'invoices', invoiceId);
  } catch {
    return json({ error: 'Could not load invoice' }, 500);
  }
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (!PAYABLE_STATUSES.has(invoice.status) || !isSafeDocId(invoice.userId)) return json({ available: false });

  let authz;
  try {
    authz = await authorizePayer(request, env, invoice, payload?.portalToken);
  } catch {
    return json({ error: 'Could not verify payer' }, 500);
  }
  if (!authz.ok) return json({ error: authz.error }, authz.status);

  try {
    const company = await getFirestoreDoc(env, 'companies', invoice.userId);
    const ready = connectedAccountCanCharge(company);
    return json({ available: ready.ok });
  } catch {
    return json({ error: 'Could not check card payment' }, 500);
  }
}

export async function handleCreateCheckoutSession(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const invoiceId = payload?.invoiceId;
  if (!isSafeDocId(invoiceId)) return json({ error: 'Invalid invoice' }, 400);
  if (!env.STRIPE_SECRET_KEY || !String(env.STRIPE_SECRET_KEY).startsWith('sk_')) {
    return json({ error: 'Online card payment is not configured.' }, 500);
  }
  if (!firestoreConfigured(env)) {
    return json({ error: 'Online card payment is not configured.' }, 500);
  }

  let invoice;
  try {
    invoice = await getFirestoreDoc(env, 'invoices', invoiceId);
  } catch {
    return json({ error: 'Could not load invoice' }, 500);
  }
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (!isSafeDocId(invoice.userId)) return json({ error: 'Invoice cannot be paid online' }, 400);
  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return json({ error: 'This invoice cannot be paid online' }, 400);
  }

  const currency = String(invoice.currency || 'CAD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return json({ error: 'Invoice currency is not supported' }, 400);
  const amount = minorUnits(invoice.total, currency);
  if (amount == null) return json({ error: 'Invoice amount must be greater than zero' }, 400);

  let authz;
  try {
    authz = await authorizePayer(request, env, invoice, payload?.portalToken);
  } catch {
    return json({ error: 'Could not verify payer' }, 500);
  }
  if (!authz.ok) return json({ error: authz.error }, authz.status);

  let company;
  try {
    company = await getFirestoreDoc(env, 'companies', invoice.userId);
  } catch {
    return json({ error: 'Could not load company' }, 500);
  }
  const ready = connectedAccountCanCharge(company);
  if (!ready.ok) {
    return json({ error: 'This company has not connected Stripe.' }, 403);
  }
  const stripeAccount = ready.stripeAccount;

  const origin = allowedAppOrigin(request);
  if (!origin) return json({ error: 'Open the invoice in the browser to pay.' }, 400);

  const { successUrl, cancelUrl } = returnUrls(origin, invoiceId, invoice, authz.via);

  const platformFee = click2BillFeeMinor(amount);
  const existingId = typeof invoice.stripeCheckoutSessionId === 'string' ? invoice.stripeCheckoutSessionId : '';
  if (/^cs_[A-Za-z0-9_]+$/.test(existingId)) {
    const existing = await stripeGet(env, `/checkout/sessions/${existingId}?expand[]=payment_intent`, stripeAccount);
    if (existing.ok) {
      const session = existing.data || {};
      const sameInvoice = session.metadata?.invoiceId === invoiceId || session.client_reference_id === invoiceId;
      const sameMoney = session.amount_total === amount && String(session.currency || '').toUpperCase() === currency;
      const intentFee = session.payment_intent && typeof session.payment_intent === 'object'
        ? Number(session.payment_intent.application_fee_amount || 0)
        : null;
      const sameFee = intentFee === platformFee;
      if (sameInvoice && session.status === 'open' && session.url && sameMoney && sameFee) {
        return json({ url: session.url });
      }
      if (sameInvoice && session.status === 'complete' && session.payment_status === 'paid') {
        return json({ error: 'This payment is already complete and is being confirmed.' }, 409);
      }
      if (sameInvoice && session.status === 'open') {
        await stripeForm(env, `/checkout/sessions/${existingId}/expire`, new URLSearchParams(), stripeAccount);
      }
    }
  }

  const invoiceNumber = String(invoice.invoiceNumber || invoiceId).replace(/[\r\n]/g, ' ').slice(0, 80);
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', invoiceId);
  params.set('metadata[invoiceId]', invoiceId);
  params.set('payment_intent_data[metadata][invoiceId]', invoiceId);
  if (platformFee > 0) params.set('payment_intent_data[application_fee_amount]', String(platformFee));
  params.append('payment_method_types[0]', 'card');
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', currency.toLowerCase());
  params.set('line_items[0][price_data][unit_amount]', String(amount));
  params.set('line_items[0][price_data][product_data][name]', `Invoice ${invoiceNumber}`);
  const receiptEmail = String(invoice.payorEmail || invoice.customerEmail || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail)) params.set('customer_email', receiptEmail);

  const created = await stripeForm(env, '/checkout/sessions', params, stripeAccount);
  if (!created.ok || !created.data?.url) {
    const message = created.data?.error?.message || 'Could not start card payment';
    console.error('Stripe Checkout session failed', created.status);
    return json({ error: message }, 502);
  }

  try {
    await patchFirestoreDoc(env, 'invoices', invoiceId, {
      stripeCheckoutSessionId: { stringValue: created.data.id },
      updatedAt: { stringValue: new Date().toISOString() },
    });
  } catch (err) {
    console.error('Could not store checkout session id', err?.message || err);
  }

  return json({ url: created.data.url });
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  let timestamp = '';
  const signatures = [];
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') timestamp = value;
    if (key === 'v1' && value) signatures.push(value);
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 300) return false;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((sig) => timingSafeEqual(sig.toLowerCase(), hex));
}

function paymentReferenceFromSession(session) {
  const intent = session?.payment_intent;
  if (typeof intent === 'string' && intent) return intent;
  if (intent && typeof intent.id === 'string') return intent.id;
  return typeof session?.id === 'string' ? session.id : '';
}

export async function handleStripeWebhook(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook is not configured' }, 500);
  if (!firestoreConfigured(env)) return json({ error: 'Webhook is not configured' }, 500);

  const rawBody = await request.text();
  const signature = request.headers.get('Stripe-Signature') || '';
  let valid = false;
  try {
    valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature check failed', err?.message || err);
    return json({ error: 'Invalid signature' }, 400);
  }
  if (!valid) return json({ error: 'Invalid signature' }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }

  if (event?.type === 'account.updated') {
    try {
      await syncStripeConnectedAccount(env, event.data?.object || {});
    } catch (err) {
      console.error('Could not save Stripe account status', err?.message || err);
      return json({ error: 'Could not record account' }, 500);
    }
    return json({ received: true });
  }

  if (event?.type !== 'checkout.session.completed') return json({ received: true });
  const session = event.data?.object || {};
  if (session.payment_status !== 'paid') return json({ received: true });

  const invoiceId = session.metadata?.invoiceId || session.client_reference_id;
  if (!isSafeDocId(invoiceId)) {
    console.error('Webhook missing invoice id');
    return json({ received: true });
  }
  const connectedAccount = typeof event.account === 'string' ? event.account : '';
  if (!/^acct_[A-Za-z0-9]+$/.test(connectedAccount)) {
    console.error('Checkout webhook missing connected account');
    return json({ received: true });
  }

  const reference = paymentReferenceFromSession(session);
  if (!reference) return json({ error: 'Missing payment reference' }, 400);

  try {
    const invoice = await getFirestoreDoc(env, 'invoices', invoiceId);
    if (!invoice) {
      console.error('Webhook invoice not found', invoiceId);
      return json({ received: true });
    }
    if (invoice.status === 'paid') return json({ received: true });
    const company = await getFirestoreDoc(env, 'companies', invoice.userId);
    if (!company || company.stripeConnectedAccountId !== connectedAccount) {
      console.error('Checkout webhook account does not match company');
      return json({ received: true });
    }
    const currency = String(invoice.currency || 'CAD').trim().toUpperCase();
    const expected = minorUnits(invoice.total, currency);
    if (expected == null || session.amount_total !== expected || String(session.currency || '').toUpperCase() !== currency) {
      console.error('Checkout webhook amount does not match invoice');
      return json({ received: true });
    }

    const paidAt = new Date().toISOString();
    await patchFirestoreDoc(env, 'invoices', invoiceId, {
      status: { stringValue: 'paid' },
      paidAt: { stringValue: paidAt },
      paymentMethod: { stringValue: 'stripe' },
      paymentReference: { stringValue: reference },
      updatedAt: { stringValue: paidAt },
    });
  } catch (err) {
    console.error('Webhook could not mark invoice paid', err?.message || err);
    return json({ error: 'Could not record payment' }, 500);
  }

  return json({ received: true });
}
