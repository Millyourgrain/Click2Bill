/**
 * Stripe Connect onboarding for the company that issues invoices.
 * Click2Bill creates a v2 merchant account and sends the company to Stripe.
 * Card payments are direct charges on that account, so Stripe deposits to the company's bank.
 */
import {
  json,
  isSafeDocId,
  firestoreConfigured,
  getFirestoreDoc,
  patchFirestoreDoc,
  lookupFirebaseUser,
  allowedAppOrigin,
  syncStripeConnectedAccount,
} from './workerPayments.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_V2_ACCOUNTS = 'https://api.stripe.com/v2/core/accounts';
const STRIPE_VERSION = '2026-09-30.endive';

function stripeReady(env) {
  return !!env.STRIPE_SECRET_KEY && String(env.STRIPE_SECRET_KEY).startsWith('sk_');
}

async function companyOwner(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = await lookupFirebaseUser(idToken, env.FIREBASE_API_KEY);
  if (!user?.localId || !isSafeDocId(user.localId)) {
    return { error: 'Sign in to connect Stripe.', status: 401 };
  }
  const profile = await getFirestoreDoc(env, 'users', user.localId);
  if (profile?.organizationOwnerId) {
    return { error: 'Only the company account can connect Stripe.', status: 403 };
  }
  return { user };
}

async function stripePost(env, path, params) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function stripeCreateConnectedAccount(env, body) {
  const res = await fetch(STRIPE_V2_ACCOUNTS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Stripe-Version': STRIPE_VERSION,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function stripeGetAccount(env, accountId) {
  const res = await fetch(`${STRIPE_API}/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function stripeErrorMessage(data, status, fallback) {
  const message = typeof data?.error?.message === 'string'
    ? data.error.message.replace(/\s+/g, ' ').trim().slice(0, 500)
    : '';
  const code = typeof data?.error?.code === 'string' ? data.error.code.slice(0, 80) : '';
  const parts = [message || fallback];
  if (code) parts.push(code);
  parts.push(`Stripe ${status}`);
  return parts.join(' — ');
}

function accountLinkUrls(origin) {
  const base = `${origin}/setup-company`;
  return {
    refreshUrl: `${base}?stripe=refresh`,
    returnUrl: `${base}?stripe=return`,
  };
}

export async function handleStripeConnectOnboarding(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!stripeReady(env) || !firestoreConfigured(env)) {
    return json({ error: 'Stripe Connect is not configured.' }, 500);
  }

  let owner;
  try {
    owner = await companyOwner(request, env);
  } catch {
    return json({ error: 'Could not verify your account.' }, 500);
  }
  if (owner.error) return json({ error: owner.error }, owner.status);

  const companyId = owner.user.localId;
  let company;
  try {
    company = await getFirestoreDoc(env, 'companies', companyId);
  } catch {
    return json({ error: 'Could not load company.' }, 500);
  }
  if (!company) return json({ error: 'Save your company profile before connecting Stripe.' }, 400);

  const origin = allowedAppOrigin(request);
  if (!origin) return json({ error: 'Open company setup in the browser to connect Stripe.' }, 400);

  let accountId = typeof company.stripeConnectedAccountId === 'string' ? company.stripeConnectedAccountId : '';
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) {
    const email = String(owner.user.email || company.email || '').trim();
    const name = String(company.legalBusinessName || company.companyName || '').replace(/[\r\n]/g, ' ').slice(0, 100);
    const body = {
      dashboard: 'full',
      identity: { country: 'ca' },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
      },
      defaults: {
        responsibilities: {
          fees_collector: 'stripe',
          losses_collector: 'stripe',
        },
      },
      metadata: { click2billCompanyId: companyId },
    };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) body.contact_email = email;
    if (name) {
      body.display_name = name;
      body.identity.business_details = { registered_name: name };
    }

    const created = await stripeCreateConnectedAccount(env, body);
    if (!created.ok || !/^acct_[A-Za-z0-9]+$/.test(created.data?.id || '')) {
      console.error('Stripe Connect account create failed', created.status, created.data?.error?.code || '');
      return json({ error: stripeErrorMessage(created.data, created.status, 'Could not start Stripe Connect.') }, 502);
    }
    accountId = created.data.id;
    try {
      await patchFirestoreDoc(env, 'companies', companyId, {
        stripeConnectedAccountId: { stringValue: accountId },
        stripeChargesEnabled: { booleanValue: false },
        stripePayoutsEnabled: { booleanValue: false },
        onlineCardPaymentEnabled: { booleanValue: false },
        updatedAt: { stringValue: new Date().toISOString() },
      });
    } catch (err) {
      console.error('Could not store Stripe account id', err?.message || err);
      return json({ error: 'Could not start Stripe Connect.' }, 500);
    }
  }

  const { refreshUrl, returnUrl } = accountLinkUrls(origin);
  const linkParams = new URLSearchParams();
  linkParams.set('account', accountId);
  linkParams.set('refresh_url', refreshUrl);
  linkParams.set('return_url', returnUrl);
  linkParams.set('type', 'account_onboarding');
  const link = await stripePost(env, '/account_links', linkParams);
  if (!link.ok || !link.data?.url) {
    console.error('Stripe Account Link failed', link.status, link.data?.error?.code || '');
    return json({ error: stripeErrorMessage(link.data, link.status, 'Could not open Stripe.') }, 502);
  }
  return json({ url: link.data.url });
}

export async function handleStripeConnectRefresh(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!stripeReady(env) || !firestoreConfigured(env)) {
    return json({ error: 'Stripe Connect is not configured.' }, 500);
  }

  let owner;
  try {
    owner = await companyOwner(request, env);
  } catch {
    return json({ error: 'Could not verify your account.' }, 500);
  }
  if (owner.error) return json({ error: owner.error }, owner.status);

  const companyId = owner.user.localId;
  const company = await getFirestoreDoc(env, 'companies', companyId);
  const accountId = company?.stripeConnectedAccountId;
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId || '')) {
    return json({ connected: false, chargesEnabled: false, payoutsEnabled: false });
  }

  const account = await stripeGetAccount(env, accountId);
  if (!account.ok) return json({ error: 'Could not read the Stripe account.' }, 502);
  if (account.data?.metadata?.click2billCompanyId !== companyId) {
    return json({ error: 'This Stripe account is not linked to your company.' }, 403);
  }
  try {
    await syncStripeConnectedAccount(env, account.data);
  } catch (err) {
    console.error('Could not save Stripe account status', err?.message || err);
    return json({ error: 'Could not save Stripe status.' }, 500);
  }
  const chargesEnabled = account.data.charges_enabled === true;
  const payoutsEnabled = account.data.payouts_enabled === true;
  return json({
    connected: true,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted: account.data.details_submitted === true,
    ready: chargesEnabled && payoutsEnabled,
  });
}
