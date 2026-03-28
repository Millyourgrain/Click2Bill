/**
 * Cloudflare Worker - handles /api/send-email and serves static assets
 * Requires: RESEND_API_KEY (secret), FIREBASE_API_KEY (var)
 */
const RESEND_API = 'https://api.resend.com/emails';
const FIREBASE_VERIFY_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function verifyFirebaseToken(idToken, apiKey) {
  const url = `${FIREBASE_VERIFY_URL}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (res.ok) return true;
  const errBody = await res.json().catch(() => ({}));
  // Visible in wrangler tail / dashboard — helps debug API key restrictions vs bad token
  console.error('Firebase accounts:lookup failed', res.status, errBody);
  return false;
}

async function sendEmailViaResend(env, { to, subject, text, html }) {
  const body = {
    from: env.FROM_EMAIL || 'Click2Bill <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    text: text || '',
    html: html || (text ? `<pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>` : ''),
  };
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Resend API error: ${res.status}`);
  }
  return data;
}

async function handleSendEmail(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: 'Missing Authorization token. Ensure you are logged in.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!env.FIREBASE_API_KEY || env.FIREBASE_API_KEY.includes('PASTE_YOUR')) {
    return new Response(JSON.stringify({ success: false, error: 'FIREBASE_API_KEY not configured. Set [vars] FIREBASE_API_KEY in wrangler.toml to the same value as VITE_FIREBASE_API_KEY, then redeploy. For local dev, use .dev.vars (see dev.vars.example).' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const valid = await verifyFirebaseToken(token, env.FIREBASE_API_KEY);
  if (!valid) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid or expired token, or Firebase API key rejected server-side. Confirm FIREBASE_API_KEY matches your Web app key; in Google Cloud → Credentials, avoid HTTP-referrer-only restriction for keys used by this Worker (see wrangler.toml comments). Try logging out and back in.',
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { to, subject, text, html } = payload;
  if (!to || !subject) {
    return new Response(JSON.stringify({ success: false, error: 'Missing to or subject' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Email service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    await sendEmailViaResend(env, { to, subject, text, html });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname === '/api/send-email' && request.method === 'POST') {
      return handleSendEmail(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
