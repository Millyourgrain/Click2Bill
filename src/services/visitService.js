import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { getWorkerOrgContext } from './workerOrgContext';
import { addNotificationForEmail } from './notificationService';

/**
 * Create a scheduled service visit for a customer
 */
export const createVisit = async (visitData) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const visitsRef = collection(db, 'visits');
    const payload = {
      userId: ctx.billingUserId,
      customerId: visitData.customerId,
      customerName: visitData.customerName || '',
      serviceAddress: visitData.serviceAddress || '',
      customerEmail: visitData.customerEmail || '',
      payorEmail: visitData.payorEmail || visitData.customerEmail || '',
      serviceDate: visitData.serviceDate || '',
      checkInTime: null,
      checkOutTime: null,
      checkInEmailSent: false,
      checkOutEmailSent: false,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(visitsRef, payload);
    return { success: true, data: { id: docRef.id, ...payload } };
  } catch (error) {
    console.error('Create visit error:', error);
    const msg = error?.message || '';
    if (msg.includes('permission') || msg.includes('Permission') || msg.includes('PERMISSION_DENIED')) {
      return { success: false, error: 'Permission denied. Add Firestore rules for the "visits" collection. See Firebase Console → Firestore → Rules.' };
    }
    if (msg.includes('unauthenticated') || msg.includes('UNAUTHENTICATED')) {
      return { success: false, error: 'Not logged in. Please sign in and try again.' };
    }
    return { success: false, error: error?.message || 'Failed to create visit' };
  }
};

/**
 * Check in – set check-in time and optionally trigger email to customer & payor
 */
export const checkIn = async (visitId) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const visitRef = doc(db, 'visits', visitId);
    const visitDoc = await getDoc(visitRef);
    if (!visitDoc.exists()) return { success: false, error: 'Visit not found' };
    const ctx = await getWorkerOrgContext();
    if (!ctx || visitDoc.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };

    const now = new Date().toISOString();
    const data = visitDoc.data();
    await updateDoc(visitRef, {
      checkInTime: now,
      checkInEmailSent: true,
      status: 'in_progress',
      updatedAt: now,
    });
    const msg = `Worker checked in for service on ${data.serviceDate || 'scheduled date'}.`;
    if (data.payorEmail) await addNotificationForEmail(data.payorEmail, { type: 'check_in', title: 'Service check-in', body: msg, metadata: { visitId } });
    if (data.customerEmail && data.customerEmail !== data.payorEmail) await addNotificationForEmail(data.customerEmail, { type: 'check_in', title: 'Service check-in', body: msg, metadata: { visitId } });
    return { success: true, data: { checkInTime: now }, message: 'Check-in recorded. Notification sent to customer and payor.' };
  } catch (error) {
    console.error('Check-in error:', error);
    return { success: false, error: 'Failed to record check-in' };
  }
};

/**
 * Check out – set check-out time and optionally trigger email to customer & payor
 */
export const checkOut = async (visitId) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const visitRef = doc(db, 'visits', visitId);
    const visitDoc = await getDoc(visitRef);
    if (!visitDoc.exists()) return { success: false, error: 'Visit not found' };
    const ctx = await getWorkerOrgContext();
    if (!ctx || visitDoc.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };

    const now = new Date().toISOString();
    const data = visitDoc.data();
    await updateDoc(visitRef, {
      checkOutTime: now,
      checkOutEmailSent: true,
      status: 'completed',
      updatedAt: now,
    });
    const msg = `Worker checked out after service on ${data.serviceDate || 'scheduled date'}.`;
    if (data.payorEmail) await addNotificationForEmail(data.payorEmail, { type: 'check_out', title: 'Service check-out', body: msg, metadata: { visitId } });
    if (data.customerEmail && data.customerEmail !== data.payorEmail) await addNotificationForEmail(data.customerEmail, { type: 'check_out', title: 'Service check-out', body: msg, metadata: { visitId } });
    return { success: true, data: { checkOutTime: now }, message: 'Check-out recorded. Notification sent to customer and payor.' };
  } catch (error) {
    console.error('Check-out error:', error);
    return { success: false, error: 'Failed to record check-out' };
  }
};

/**
 * Manually set check-in and/or check-out times (for same-day or retrospective entry)
 */
export const updateVisitCheckTimes = async (visitId, { checkInTime, checkOutTime }) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const visitRef = doc(db, 'visits', visitId);
    const visitDoc = await getDoc(visitRef);
    if (!visitDoc.exists()) return { success: false, error: 'Visit not found' };
    const ctx = await getWorkerOrgContext();
    if (!ctx || visitDoc.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };

    const updates = { updatedAt: new Date().toISOString() };
    if (checkInTime != null) {
      updates.checkInTime = new Date(checkInTime).toISOString();
      updates.status = 'in_progress';
    }
    if (checkOutTime != null) {
      updates.checkOutTime = new Date(checkOutTime).toISOString();
      updates.status = 'completed';
    }

    await updateDoc(visitRef, updates);
    return { success: true, message: 'Check times updated.' };
  } catch (error) {
    console.error('Update check times error:', error);
    return { success: false, error: 'Failed to update' };
  }
};

/**
 * Get all visits for current user (optionally filter by customerId in memory; no composite index)
 */
export const getVisits = async (filters = {}) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const visitsRef = collection(db, 'visits');
    const q = query(visitsRef, where('userId', '==', ctx.billingUserId));
    const snapshot = await getDocs(q);
    let visits = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (filters.customerId) {
      visits = visits.filter((v) => v.customerId === filters.customerId);
    }
    return { success: true, data: visits };
  } catch (error) {
    console.error('Get visits error:', error);
    return { success: false, error: 'Failed to retrieve visits', data: [] };
  }
};

/**
 * Get total hours from completed visits for a customer within a date range (for invoice)
 */
export const getVisitsHoursInRange = async (customerId, startDate, endDate) => {
  try {
    const result = await getVisits({ customerId });
    if (!result.success || !result.data) return { success: true, totalHours: 0, visits: [] };

    const start = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
    const end = endDate ? new Date(endDate + 'T23:59:59').getTime() : Number.MAX_SAFE_INTEGER;

    const inRange = result.data.filter((v) => {
      if (!v.checkInTime || !v.checkOutTime || v.status !== 'completed') return false;
      const visitDate = new Date(v.serviceDate || v.checkInTime).getTime();
      return visitDate >= start && visitDate <= end;
    });

    let totalHours = 0;
    inRange.forEach((v) => {
      totalHours += getVisitHours(v);
    });

    return { success: true, totalHours, visits: inRange };
  } catch (error) {
    console.error('Get visits hours in range error:', error);
    return { success: false, totalHours: 0, visits: [] };
  }
};

/**
 * Get single visit by ID
 */
export const getVisit = async (visitId) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const visitRef = doc(db, 'visits', visitId);
    const visitDoc = await getDoc(visitRef);
    if (!visitDoc.exists()) return { success: false, error: 'Visit not found' };
    const data = visitDoc.data();
    const ctx = await getWorkerOrgContext();
    if (!ctx || data.userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };

    return { success: true, data: { id: visitDoc.id, ...data } };
  } catch (error) {
    console.error('Get visit error:', error);
    return { success: false, error: 'Failed to retrieve visit' };
  }
};

/**
 * Get hours between check-in and check-out for a visit (for invoice)
 */
export const getVisitHours = (visit) => {
  if (!visit || !visit.checkInTime || !visit.checkOutTime) return 0;
  const start = new Date(visit.checkInTime).getTime();
  const end = new Date(visit.checkOutTime).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60));
};

/**
 * Get equivalent days (hours / 8) for a visit
 */
export const getVisitDays = (visit) => {
  const hours = getVisitHours(visit);
  return hours / 8;
};
