/**
 * exportFirestore.cjs
 * ─────────────────────────────────────────────────────────────────
 * Exports every Click2Bill Firestore collection to a JSON file.
 *
 * SETUP (one-time):
 *   1. npm install firebase-admin          (only needed once)
 *   2. Download a service-account key:
 *        Firebase Console → Project Settings → Service accounts
 *        → Generate new private key  →  save as serviceAccountKey.json
 *        in the same folder as this file.
 *   3. node exportFirestore.cjs
 *
 * OUTPUT FILES (written to ./firestore-export/):
 *   export_invoices.json
 *   export_users.json
 *   export_companies.json
 *   export_customers.json
 *   export_travelRecords.json
 *   export_visits.json
 *   export_invoiceDeletions.json
 * ─────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

// ── Load service-account credentials ────────────────────────────
const KEY_FILE = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(KEY_FILE)) {
  console.error(
    '\n❌  serviceAccountKey.json not found.\n' +
    '    Download it from Firebase Console → Project Settings → Service accounts\n' +
    '    and place it in the same folder as this script.\n'
  );
  process.exit(1);
}

const serviceAccount = require(KEY_FILE);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── Collections to export ────────────────────────────────────────
const COLLECTIONS = [
  'invoices',
  'users',
  'companies',
  'customers',
  'travelRecords',
  'visits',
  'invoiceDeletions',
];

// ── Output folder ────────────────────────────────────────────────
const OUT_DIR = path.join(__dirname, 'firestore-export');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ── Helper: recursively convert Firestore Timestamps to ISO strings
function sanitize(value) {
  if (value === null || value === undefined) return value;

  // Firestore Timestamp
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitize(v);
    }
    return out;
  }

  return value;
}

// ── Export one collection ────────────────────────────────────────
async function exportCollection(name) {
  try {
    const snapshot = await db.collection(name).get();

    if (snapshot.empty) {
      console.log(`  ⚪  "${name}" — empty collection, skipping`);
      return;
    }

    const data = {};
    snapshot.forEach(docSnap => {
      data[docSnap.id] = sanitize(docSnap.data());
    });

    const filePath = path.join(OUT_DIR, `export_${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  ✅  "${name}" — ${snapshot.size} documents → export_${name}.json`);
  } catch (err) {
    console.error(`  ❌  "${name}" — failed: ${err.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────
async function run() {
  console.log('\n📦  Click2Bill — Firestore Export');
  console.log(`    Output folder: ${OUT_DIR}\n`);

  for (const col of COLLECTIONS) {
    await exportCollection(col);
  }

  console.log('\n✔   Export complete.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
