/**
 * Click2Bill — Firebase Cloud Functions (2nd gen)
 *
 * Deploy: from repo root, set .firebaserc project id, then:
 *   npm run functions:install
 *   npm run firebase:deploy:functions
 *
 * Health URL (after deploy):
 *   https://<region>-<project-id>.cloudfunctions.net/health
 */
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const REGION = 'us-central1';

/** Public health check — use for uptime / wiring */
exports.health = onRequest({ region: REGION, cors: true }, (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'click2bill',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Callable — requires Firebase Auth.
 * Returns token claims; extend for server-only logic (admin, webhooks, etc.).
 */
exports.whoami = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const user = await admin.auth().getUser(request.auth.uid);
  return {
    uid: user.uid,
    email: user.email ?? null,
  };
});
