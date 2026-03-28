import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
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
    const payload = {
      userId: ctx.billingUserId,
      distanceKm: record.distanceKm != null ? Number(record.distanceKm) : 0,
      roundTripKm: record.roundTripKm != null ? Number(record.roundTripKm) : (record.distanceKm != null ? Number(record.distanceKm) * 2 : 0),
      travelDate: record.travelDate || new Date().toISOString().split('T')[0],
      origin: record.origin || '',
      destination: record.destination || '',
      description: record.description || '',
      totalCost: record.totalCost != null ? Number(record.totalCost) : null,
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
export const getTotalDistanceKm = async () => {
  try {
    const result = await getTravelRecords();
    if (!result.success || !result.data) return { success: true, totalKm: 0, data: [] };
    const totalKm = result.data.reduce((sum, r) => {
      const km = r.roundTripKm != null ? r.roundTripKm : (r.distanceKm != null ? r.distanceKm * 2 : 0);
      return sum + km;
    }, 0);
    return { success: true, totalKm, data: result.data };
  } catch (error) {
    return { success: false, totalKm: 0, data: [] };
  }
};
