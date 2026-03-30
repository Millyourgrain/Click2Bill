import { collection, query, where, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

/**
 * Find user ID by email (for sending notifications to customer/payor)
 */
export const getUserIdByEmail = async (email) => {
  if (!email) return null;
  const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
  const snap = await getDocs(q);
  return snap.docs[0]?.id || null;
};

const COLLECTION = 'notifications';

/**
 * Add a notification for a user (e.g. worker or customer)
 */
export const addNotification = async (payload) => {
  try {
    const { userId, type, title, body, link, metadata } = payload;
    const ref = collection(db, COLLECTION);
    await addDoc(ref, {
      userId,
      type,
      title: title || type,
      body: body || '',
      link: link || '',
      metadata: metadata || {},
      read: false,
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Add notification error:', error);
    return { success: false };
  }
};

/**
 * Notify billing org owner and invoice creator (e.g. accept/contest alerts for makers).
 */
export const notifyInvoiceOrgMembers = async (invoice, { type, title, body, link, metadata }) => {
  const invoiceId = invoice?.id || '';
  const targets = new Set();
  if (invoice?.userId) targets.add(invoice.userId);
  if (invoice?.createdByUid) targets.add(invoice.createdByUid);
  const defaultLink = invoiceId ? `/invoices/${invoiceId}` : '/dashboard';
  for (const userId of targets) {
    await addNotification({
      userId,
      type,
      title,
      body,
      link: link || defaultLink,
      metadata: { invoiceId, ...(metadata || {}) },
    });
  }
};

/**
 * Add notification for a user identified by email (e.g. customer/payor)
 */
export const addNotificationForEmail = async (email, payload) => {
  const userId = await getUserIdByEmail(email);
  if (!userId) return { success: false, error: 'User not found for email' };
  return addNotification({ ...payload, userId });
};

/**
 * Get notifications for current user
 */
export const getMyNotifications = async (limit = 50) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not authenticated' };

    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, data: list };
  } catch (error) {
    console.error('Get notifications error:', error);
    return { success: false, data: [] };
  }
};
