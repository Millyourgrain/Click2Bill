import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { getWorkerOrgContext } from './workerOrgContext';

const COLLECTION = 'travelRecords';

/**
 * Save a business travel record (e.g. when worker calculates trip or adds to invoice)
 */
export const addTravelRecord = async (record) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const ref = collection(db, COLLECTION);
    const oneWay = record.distanceKm != null ? Number(record.distanceKm) : 0;
    const explicitRt = record.roundTripKm != null ? Number(record.roundTripKm) : null;
    const payload = {
      userId: ctx.billingUserId,
      distanceKm: oneWay,
      roundTripKm: explicitRt != null ? explicitRt : (oneWay > 0 ? oneWay * 2 : 0),
      tripMode: record.tripMode || null,
      travelDate: record.travelDate || new Date().toISOString().split('T')[0],
      origin: record.origin || '',
      destination: record.destination || '',
      description: record.description || '',
      totalCost: record.totalCost != null ? Number(record.totalCost) : null,
      invoiceId: record.invoiceId || null,
      invoiceNumber: record.invoiceNumber || null,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(ref, payload);
    return { success: true, data: { id: docRef.id, ...payload } };
  } catch (error) {
    console.error('Add travel record error:', error);
    return { success: false, error: 'Failed to save travel record' };
  }
};

/**
 * Get all travel records for current user
 */
export const getTravelRecords = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const ref = collection(db, COLLECTION);
    const q = query(ref, where('userId', '==', ctx.billingUserId));
    const snapshot = await getDocs(q);
    const records = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || b.travelDate || 0) - new Date(a.createdAt || a.travelDate || 0));
    return { success: true, data: records };
  } catch (error) {
    console.error('Get travel records error:', error);
    return { success: false, error: 'Failed to load records', data: [] };
  }
};

/**
 * Get total business distance (km) for current user
 */
/**
 * Remove travel register rows linked to an invoice (before invoice delete or before resync).
 */
export const deleteTravelRecordsForInvoice = async (invoiceId) => {
  try {
    const user = auth.currentUser;
    if (!user || !invoiceId) return { success: false, error: 'Not authenticated' };
    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'Not authenticated' };
    const ref = collection(db, COLLECTION);
    const q = query(ref, where('userId', '==', ctx.billingUserId), where('invoiceId', '==', invoiceId));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, COLLECTION, d.id))));
    return { success: true, deleted: snapshot.docs.length };
  } catch (error) {
    console.error('deleteTravelRecordsForInvoice error:', error);
    return { success: false, error: 'Failed to update travel register' };
  }
};

/**
 * Replace travel register rows for an invoice from current travel line items (e.g. after amend).
 */
export const replaceTravelRecordsForInvoice = async (invoiceId, invoiceNumber, travelItems) => {
  const del = await deleteTravelRecordsForInvoice(invoiceId);
  if (!del.success) return del;
  const items = Array.isArray(travelItems) ? travelItems : [];
  for (const item of items) {
    const rec = {
      distanceKm: item.distanceKm ?? (item.roundTripKm ? item.roundTripKm / 2 : 0),
      roundTripKm: item.roundTripKm ?? (item.distanceKm ? item.distanceKm * 2 : 0),
      travelDate: item.date || new Date().toISOString().split('T')[0],
      origin: item.origin || '',
      destination: item.destination || '',
      description: item.description || '',
      totalCost: item.amount ?? item.rate ?? 0,
      invoiceId,
      invoiceNumber: invoiceNumber || null,
    };
    await addTravelRecord(rec).catch((e) => console.warn('Travel record sync failed:', e));
  }
  return { success: true };
};

export const getTotalDistanceKm = async () => {
  try {
    const result = await getTravelRecords();
    if (!result.success || !result.data) return { success: true, totalKm: 0, data: [] };
    const totalKm = result.data.reduce((sum, r) => {
      const km = r.roundTripKm != null ? Number(r.roundTripKm) : (r.distanceKm != null ? Number(r.distanceKm) : 0);
      return sum + km;
    }, 0);
    return { success: true, totalKm, data: result.data };
  } catch (error) {
    return { success: false, totalKm: 0, data: [] };
  }
};
