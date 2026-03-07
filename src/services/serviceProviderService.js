import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const COLLECTION = 'serviceProviders';

export const SERVICE_TYPES = [
  'PSW',
  'RPN',
  'RN',
  'Caregiver/companion',
  'Independent contractor/Service provider',
  'Other',
];

/**
 * Add a service provider for the current customer
 */
export const addServiceProvider = async (data) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const payload = {
      customerUserId: user.uid,
      serviceType: data.serviceType,
      serviceTypeOther: data.serviceType === 'Other' ? (data.serviceTypeOther || '') : '',
      providerName: data.providerName || '',
      providerEmail: data.providerEmail || '',
      providerPhone: data.providerPhone || '',
      companyName: data.companyName || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = await addDoc(collection(db, COLLECTION), payload);
    return { success: true, id: ref.id, data: { id: ref.id, ...payload } };
  } catch (err) {
    console.error('Add service provider error:', err);
    return { success: false, error: 'Failed to add service provider' };
  }
};

/**
 * Get all service providers for the current customer
 */
export const getServiceProviders = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated', data: [] };

    const q = query(collection(db, COLLECTION), where('customerUserId', '==', user.uid));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, data: list };
  } catch (err) {
    console.error('Get service providers error:', err);
    return { success: false, error: 'Failed to load providers', data: [] };
  }
};

/**
 * Update a service provider
 */
export const updateServiceProvider = async (id, updates) => {
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
    console.error('Update service provider error:', err);
    return { success: false, error: 'Failed to update provider' };
  }
};

/**
 * Delete a service provider
 */
export const deleteServiceProvider = async (id) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    await deleteDoc(doc(db, COLLECTION, id));
    return { success: true };
  } catch (err) {
    console.error('Delete service provider error:', err);
    return { success: false, error: 'Failed to delete provider' };
  }
};
