/**
 * HelcimPay.js for the Cloudflare Worker.
 * Pay now initializes a checkout on Helcim (Canada). The browser only receives a checkoutToken
 * and opens Helcim's modal. Card numbers stay on Helcim. The secretToken never leaves this worker.
 * Stripe Checkout in workerPayments.js is unchanged.
 */
import {
  PAYABLE_STATUSES,
  json,
  isSafeDocId,
  firestoreConfigured,
  getFirestoreDoc,
  patchFirestoreDoc,
  deleteFirestoreDoc,
  authorizePayer,
  getGoogleAccessToken,
  unwrapDoc,
  timingSafeEqual,
} from './workerPayments.js';

const HELCIM_API = 'https://api.helcim.com/v2';
const HELCIM_CURRENCIES = new Set(['CAD', 'USD']);
const SESSION_COLLECTION = 'cardCheckoutSessions';
const SESSION_TTL_MS = 55 * 60 * 1000;

function helcimConfigured(env) {
  const token = String(env.HELCIM_API_TOKEN || '').trim();
  return token.length >= 8 && !token.includes('PASTE_YOUR') && token !== 'placeholder';
}

function majorToCents(value) {
  const raw = typeof value === 'string' ? value.trim() : value;
  if (typeof raw === 'string' && !/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  const cents = Math.round(num * 100);
  if (Math.abs(num * 100 - cents) > 0.001) return null;
  return cents;
}

function helcimInvoiceNumber(invoice, invoiceId) {
  const raw = String(invoice.invoiceNumber || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20);
  if (raw.length >= 1) return raw;
  return `C2B${invoiceId}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
}

function isCheckoutToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9]{8,128}$/.test(value);
}

async function loadPayableInvoice(env, invoiceId) {
  if (!isSafeDocId(invoiceId)) return { error: 'Invalid invoice', status: 400 };
  if (!firestoreConfigured(env)) return { error: 'Online card payment is not configured.', status: 500 };
  let invoice;
  try {
    invoice = await getFirestoreDoc(env, 'invoices', invoiceId);
  } catch {
    return { error: 'Could not load invoice', status: 500 };
  }
  if (!invoice) return { error: 'Invoice not found', status: 404 };
  if (!isSafeDocId(invoice.userId)) return { error: 'Invoice cannot be paid online', status: 400 };
  const currency = String(invoice.currency || 'CAD').trim().toUpperCase();
  if (!HELCIM_CURRENCIES.has(currency)) {
    return { error: 'Helcim accepts CAD and USD invoices.', status: 400 };
  }
  const cents = majorToCents(invoice.total);
  if (cents == null) return { error: 'Invoice amount must be greater than zero', status: 400 };
  return { invoice, currency, cents };
}

async function companyAllowsCardPay(env, invoice) {
  let company;
  try {
    company = await getFirestoreDoc(env, 'companies', invoice.userId);
  } catch {
    return { error: 'Could not load company', status: 500 };
  }
  if (!company || company.onlineCardPaymentEnabled !== true) {
    return { error: 'Online card payment is not enabled for this invoice.', status: 403 };
  }
  return { company };
}

/**
 * PHP json_encode defaults: compact JSON, slash escaped, non-ASCII as \uXXXX.
 * Helcim hashes that encoding plus the secretToken.
 */
export function phpJsonEncode(value) {
  const json = JSON.stringify(value);
  let out = '';
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    if (json[i] === '/') {
      out += '\\/';
      continue;
    }
    if (code > 0x7f) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
      continue;
    }
    out += json[i];
  }
  return out;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseHelcimEventMessage(eventMessage) {
  let parsed;
  try {
    parsed = JSON.parse(eventMessage);
  } catch {
    return null;
  }
  if (parsed && parsed.data && typeof parsed.data === 'object' && parsed.data.hash && parsed.data.data) {
    return { hash: String(parsed.data.hash), data: parsed.data.data };
  }
  if (parsed && parsed.hash && parsed.data && typeof parsed.data === 'object') {
    return { hash: String(parsed.hash), data: parsed.data };
  }
  return null;
}

function approvedCardPayment(data, expectedCents, currency) {
  const status = String(data.status || '').toUpperCase();
  const type = String(data.type || '').toLowerCase();
  if (status !== 'APPROVED' || (type && type !== 'purchase')) return null;
  const responseCurrency = String(data.currency || '').toUpperCase();
  if (responseCurrency !== currency) return null;
  const cents = majorToCents(data.amount);
  if (cents == null || cents !== expectedCents) return null;
  const transactionId = String(data.transactionId || '');
  if (!/^\d{1,20}$/.test(transactionId)) return null;
  return transactionId;
}

async function markInvoicePaid(env, invoiceId, invoice, transactionId) {
  if (invoice.status === 'paid') return;
  const paidAt = new Date().toISOString();
  await patchFirestoreDoc(env, 'invoices', invoiceId, {
    status: { stringValue: 'paid' },
    paidAt: { stringValue: paidAt },
    paymentMethod: { stringValue: 'helcim' },
    paymentReference: { stringValue: transactionId },
    updatedAt: { stringValue: paidAt },
  });
}

export async function handleCreateHelcimSession(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!helcimConfigured(env)) return json({ error: 'Online card payment is not configured.' }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const loaded = await loadPayableInvoice(env, payload?.invoiceId);
  if (loaded.error) return json({ error: loaded.error }, loaded.status);
  const { invoice, currency, cents } = loaded;
  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return json({ error: 'This invoice cannot be paid online' }, 400);
  }

  let authz;
  try {
    authz = await authorizePayer(request, env, invoice, payload?.portalToken);
  } catch {
    return json({ error: 'Could not verify payer' }, 500);
  }
  if (!authz.ok) return json({ error: authz.error }, authz.status);

  const companyCheck = await companyAllowsCardPay(env, invoice);
  if (companyCheck.error) return json({ error: companyCheck.error }, companyCheck.status);

  const invoiceNumber = helcimInvoiceNumber(invoice, payload.invoiceId);
  const amount = cents / 100;
  let created;
  try {
    const res = await fetch(`${HELCIM_API}/helcim-pay/initialize`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-token': String(env.HELCIM_API_TOKEN).trim(),
      },
      body: JSON.stringify({
        paymentType: 'purchase',
        amount,
        currency,
        paymentMethod: 'cc',
        allowPartial: 0,
        confirmationScreen: true,
        language: 'en',
        invoiceNumber,
      }),
    });
    created = await res.json().catch(() => ({}));
    if (!res.ok || !created.checkoutToken || !created.secretToken) {
      console.error('Helcim initialize failed', res.status);
      return json({ error: 'Could not start card payment' }, 502);
    }
  } catch (err) {
    console.error('Helcim initialize error', err?.message || err);
    return json({ error: 'Could not start card payment' }, 502);
  }

  if (!isCheckoutToken(created.checkoutToken) || typeof created.secretToken !== 'string') {
    return json({ error: 'Could not start card payment' }, 502);
  }

  const now = new Date().toISOString();
  try {
    await patchFirestoreDoc(env, SESSION_COLLECTION, created.checkoutToken, {
      invoiceId: { stringValue: payload.invoiceId },
      secretToken: { stringValue: created.secretToken },
      amountCents: { integerValue: String(cents) },
      currency: { stringValue: currency },
      invoiceNumber: { stringValue: invoiceNumber },
      createdAt: { stringValue: now },
    });
    await patchFirestoreDoc(env, 'invoices', payload.invoiceId, {
      helcimInvoiceNumber: { stringValue: invoiceNumber },
      updatedAt: { stringValue: now },
    });
  } catch (err) {
    console.error('Could not store Helcim checkout session', err?.message || err);
    return json({ error: 'Could not start card payment' }, 500);
  }

  return json({ checkoutToken: created.checkoutToken });
}

export async function handleConfirmHelcimPayment(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!firestoreConfigured(env)) return json({ error: 'Online card payment is not configured.' }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const invoiceId = payload?.invoiceId;
  const checkoutToken = payload?.checkoutToken;
  const eventMessage = payload?.eventMessage;
  if (!isSafeDocId(invoiceId) || !isCheckoutToken(checkoutToken)) {
    return json({ error: 'Invalid payment response' }, 400);
  }
  if (typeof eventMessage !== 'string' || eventMessage.length < 2 || eventMessage.length > 20000) {
    return json({ error: 'Invalid payment response' }, 400);
  }

  const loaded = await loadPayableInvoice(env, invoiceId);
  if (loaded.error) return json({ error: loaded.error }, loaded.status);
  const { invoice, currency, cents } = loaded;

  let authz;
  try {
    authz = await authorizePayer(request, env, invoice, payload?.portalToken);
  } catch {
    return json({ error: 'Could not verify payer' }, 500);
  }
  if (!authz.ok) return json({ error: authz.error }, authz.status);

  if (invoice.status === 'paid') return json({ paid: true });
  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return json({ error: 'This invoice cannot be paid online' }, 400);
  }

  let session;
  try {
    session = await getFirestoreDoc(env, SESSION_COLLECTION, checkoutToken);
  } catch {
    return json({ error: 'Could not confirm payment' }, 500);
  }
  if (!session || session.invoiceId !== invoiceId || typeof session.secretToken !== 'string') {
    return json({ error: 'This payment session has expired. Choose Pay now again.' }, 400);
  }
  const createdMs = Date.parse(session.createdAt || '');
  if (!Number.isFinite(createdMs) || Date.now() - createdMs > SESSION_TTL_MS) {
    return json({ error: 'This payment session has expired. Choose Pay now again.' }, 400);
  }
  if (Number(session.amountCents) !== cents || String(session.currency || '').toUpperCase() !== currency) {
    return json({ error: 'Payment amount does not match this invoice.' }, 400);
  }

  const parsed = parseHelcimEventMessage(eventMessage);
  if (!parsed || !/^[a-f0-9]{64}$/i.test(parsed.hash)) {
    return json({ error: 'Payment could not be confirmed.' }, 400);
  }

  const expected = await sha256Hex(phpJsonEncode(parsed.data) + session.secretToken);
  if (!timingSafeEqual(expected.toLowerCase(), parsed.hash.toLowerCase())) {
    console.error('Helcim response hash did not match');
    return json({ error: 'Payment could not be confirmed.' }, 400);
  }

  const transactionId = approvedCardPayment(parsed.data, cents, currency);
  if (!transactionId) return json({ error: 'Payment was not approved for this invoice amount.' }, 400);

  try {
    const fresh = await getFirestoreDoc(env, 'invoices', invoiceId);
    if (!fresh) return json({ error: 'Invoice not found' }, 404);
    if (fresh.status !== 'paid') {
      if (!PAYABLE_STATUSES.has(fresh.status)) {
        return json({ error: 'This invoice cannot be paid online' }, 400);
      }
      await markInvoicePaid(env, invoiceId, fresh, transactionId);
    }
  } catch (err) {
    console.error('Could not record Helcim payment', err?.message || err);
    return json({ error: 'Could not record payment' }, 500);
  }

  try {
    await deleteFirestoreDoc(env, SESSION_COLLECTION, checkoutToken);
  } catch (err) {
    console.error('Could not delete Helcim checkout session', err?.message || err);
  }

  return json({ paid: true });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyHelcimWebhook(rawBody, request, verifierToken) {
  const webhookId = request.headers.get('webhook-id') || '';
  const timestamp = request.headers.get('webhook-timestamp') || '';
  const header = request.headers.get('webhook-signature') || '';
  if (!webhookId || !/^\d+$/.test(timestamp) || !header) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 300) return false;

  let keyBytes;
  try {
    keyBytes = base64ToBytes(verifierToken);
  } catch {
    return false;
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = `${webhookId}.${timestamp}.${rawBody}`;
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signed));
  let bin = '';
  const bytes = new Uint8Array(mac);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const expected = btoa(bin);

  const signatures = header.split(' ').map((part) => {
    const idx = part.indexOf(',');
    return idx === -1 ? '' : part.slice(idx + 1).trim();
  }).filter(Boolean);
  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

async function queryInvoicesByField(env, fieldPath, value) {
  const token = await getGoogleAccessToken(env);
  const project = encodeURIComponent(env.FIREBASE_PROJECT_ID);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'invoices' }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
          limit: 10,
        },
      }),
    },
  );
  if (!res.ok) {
    console.error('Invoice lookup failed', res.status);
    throw new Error('Invoice lookup failed');
  }
  const rows = await res.json();
  const out = [];
  for (const row of rows || []) {
    const name = row?.document?.name;
    if (!name) continue;
    const id = name.split('/').pop();
    if (!isSafeDocId(id)) continue;
    out.push({ id, ...unwrapDoc(row.document) });
  }
  return out;
}

export async function handleHelcimWebhook(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const verifier = String(env.HELCIM_WEBHOOK_VERIFIER || '').trim();
  if (!verifier || !helcimConfigured(env) || !firestoreConfigured(env)) {
    return json({ error: 'Webhook is not configured' }, 500);
  }

  const rawBody = await request.text();
  let valid = false;
  try {
    valid = await verifyHelcimWebhook(rawBody, request, verifier);
  } catch (err) {
    console.error('Helcim webhook signature check failed', err?.message || err);
    return json({ error: 'Invalid signature' }, 400);
  }
  if (!valid) return json({ error: 'Invalid signature' }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }
  if (event?.type !== 'cardTransaction') return json({ received: true });
  const transactionId = String(event.id || '');
  if (!/^\d{1,20}$/.test(transactionId)) return json({ received: true });

  let txn;
  try {
    const res = await fetch(`${HELCIM_API}/card-transactions/${transactionId}`, {
      headers: {
        accept: 'application/json',
        'api-token': String(env.HELCIM_API_TOKEN).trim(),
      },
    });
    txn = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Helcim transaction lookup failed', res.status);
      return json({ error: 'Could not load transaction' }, 502);
    }
  } catch (err) {
    console.error('Helcim transaction lookup error', err?.message || err);
    return json({ error: 'Could not load transaction' }, 502);
  }

  const record = txn?.invoiceNumber ? txn : (txn?.cardTransaction || txn?.data || txn || {});
  const invoiceNumber = String(record.invoiceNumber || '');
  const currency = String(record.currency || '').toUpperCase();
  const cents = majorToCents(record.amount ?? record.transactionAmount);
  const approved = String(record.status || '').toUpperCase() === 'APPROVED';
  if (!invoiceNumber || !HELCIM_CURRENCIES.has(currency) || cents == null || !approved) {
    return json({ received: true });
  }

  try {
    const matches = await queryInvoicesByField(env, 'helcimInvoiceNumber', invoiceNumber);
    const payable = matches.filter((inv) => (
      PAYABLE_STATUSES.has(inv.status)
      && majorToCents(inv.total) === cents
      && String(inv.currency || 'CAD').toUpperCase() === currency
    ));
    if (payable.length !== 1) return json({ received: true });
    await markInvoicePaid(env, payable[0].id, payable[0], transactionId);
  } catch (err) {
    console.error('Helcim webhook could not mark invoice paid', err?.message || err);
    return json({ error: 'Could not record payment' }, 500);
  }

  return json({ received: true });
}
