import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const COLLECTION = 'serviceAppointments';

/**
 * Add a service appointment (from provider or manual)
 */
export const addServiceAppointment = async (data) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const payload = {
      customerUserId: user.uid,
      providerId: data.providerId || null,
      providerName: data.providerName || '',
      appointmentDate: data.appointmentDate || null,
      checkIn: data.checkIn || null,
      checkOut: data.checkOut || null,
      serviceType: data.serviceType || '',
      notes: data.notes || '',
      invoiceId: data.invoiceId || null,
      manualInvoiceAmount: data.manualInvoiceAmount || null,
      manualInvoiceRef: data.manualInvoiceRef || '',
      manualInvoiceDate: data.manualInvoiceDate || null,
      isManual: !!data.isManual,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = await addDoc(collection(db, COLLECTION), payload);
    return { success: true, id: ref.id, data: { id: ref.id, ...payload } };
  } catch (err) {
    console.error('Add service appointment error:', err);
    return { success: false, error: 'Failed to add appointment' };
  }
};

/**
 * Get all service appointments for the current customer
 */
export const getServiceAppointments = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated', data: [] };

    const q = query(collection(db, COLLECTION), where('customerUserId', '==', user.uid));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.appointmentDate || b.createdAt) - new Date(a.appointmentDate || a.createdAt));
    return { success: true, data: list };
  } catch (err) {
    console.error('Get service appointments error:', err);
    return { success: false, error: 'Failed to load appointments', data: [] };
  }
};

/**
 * Update a service appointment (e.g. add invoice link)
 */
export const updateServiceAppointment = async (id, updates) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(doc(db, COLLECTION, id), payload);
    return { success: true };
  } catch (err) {
    console.error('Update service appointment error:', err);
    return { success: false, error: 'Failed to update appointment' };
  }
};

/**
 * Delete a service appointment
 */
export const deleteServiceAppointment = async (id) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    await deleteDoc(doc(db, COLLECTION, id));
    return { success: true };
  } catch (err) {
    console.error('Delete service appointment error:', err);
    return { success: false, error: 'Failed to delete appointment' };
  }
};

/**
 * Get a single appointment by ID
 */
export const getServiceAppointment = async (id) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return { success: false, error: 'Appointment not found' };
    const data = snap.data();
    if (data.customerUserId !== user.uid) return { success: false, error: 'Unauthorized' };
    return { success: true, data: { id: snap.id, ...data } };
  } catch (err) {
    console.error('Get service appointment error:', err);
    return { success: false, error: 'Failed to load appointment' };
  }
};
