import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

let cache = { at: 0, uid: null, payload: null };
const TTL_MS = 20000;

/**
 * Resolves organization billing scope for workers: all org invoices/customers/travel
 * use billingUserId = organizationOwnerId || uid.
 */
export async function getWorkerOrgContext() {
  const user = auth.currentUser;
  if (!user) return null;
  const now = Date.now();
  if (cache.uid === user.uid && cache.payload && now - cache.at < TTL_MS) {
    return cache.payload;
  }

  const snap = await getDoc(doc(db, 'users', user.uid));
  const data = snap.exists() ? snap.data() : {};
  const org = typeof data.organizationOwnerId === 'string' ? data.organizationOwnerId.trim() : '';
  const billingUserId = org || user.uid;
  const userTeamRole = typeof data.userTeamRole === 'string' ? data.userTeamRole.toLowerCase() : '';

  const payload = {
    uid: user.uid,
    billingUserId,
    organizationOwnerId: org,
    userTeamRole,
  };
  cache = { at: now, uid: user.uid, payload };
  return payload;
}

/**
 * @param {object} ctx from getWorkerOrgContext()
 * @returns {'org_admin'|'maker'|'checker'}
 */
export function getWorkerDashboardPersona(ctx) {
  if (!ctx) return 'org_admin';
  if (ctx.organizationOwnerId) {
    if (ctx.userTeamRole === 'admin') return 'org_admin';
    if (ctx.userTeamRole === 'checker') return 'checker';
    if (ctx.userTeamRole === 'maker') return 'maker';
    return 'maker';
  }
  if (!ctx.userTeamRole) return 'org_admin';
  if (ctx.userTeamRole === 'admin') return 'org_admin';
  if (ctx.userTeamRole === 'checker') return 'checker';
  if (ctx.userTeamRole === 'maker') return 'maker';
  return 'org_admin';
}

/** Maker–checker: who may create/edit/submit drafts */
export function canActAsInvoiceMaker(ctx) {
  const p = getWorkerDashboardPersona(ctx);
  return p === 'maker' || p === 'org_admin';
}

/** Maker–checker: who may approve or issue (send) to customer */
export function canActAsInvoiceChecker(ctx) {
  const p = getWorkerDashboardPersona(ctx);
  return p === 'checker' || p === 'org_admin';
}
