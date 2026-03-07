import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';

/**
 * Add or update customer/patient profile (full PSW workflow)
 */
export const addCustomer = async (customerData) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const customersRef = collection(db, 'customers');
    const payload = {
      userId: user.uid,
      customerName: customerData.customerName || '',
      customerDob: customerData.customerDob || '',
      serviceAddress: customerData.serviceAddress || '',
      customerEmail: customerData.customerEmail || '',
      customerPhone: customerData.customerPhone || '',
      typeOfService: customerData.typeOfService || '',
      frequencyOfService: customerData.frequencyOfService || '',
      hasEngagementAgreement: customerData.hasEngagementAgreement ?? null,
      engagementAgreementUrl: customerData.engagementAgreementUrl || '',
      isPayorSameAsCustomer: customerData.isPayorSameAsCustomer ?? null,
      payorName: customerData.payorName || '',
      payorDob: customerData.payorDob || '',
      payorRelationship: customerData.payorRelationship || '',
      payorEmail: customerData.payorEmail || '',
      payorPhone: customerData.payorPhone || '',
      sendServiceNotification: customerData.sendServiceNotification ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(customersRef, payload);
    return {
      success: true,
      message: 'Customer added successfully',
      data: { id: docRef.id, ...payload },
    };
  } catch (error) {
    console.error('Add customer error:', error);
    return { success: false, error: 'Failed to add customer' };
  }
};

/**
 * Update customer
 */
export const updateCustomer = async (customerId, updates) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    if (!customerDoc.exists()) return { success: false, error: 'Customer not found' };
    if (customerDoc.data().userId !== user.uid) return { success: false, error: 'Unauthorized' };

    await updateDoc(customerRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return { success: true, message: 'Customer updated successfully' };
  } catch (error) {
    console.error('Update customer error:', error);
    return { success: false, error: 'Failed to update customer' };
  }
};

/**
 * Upload customer engagement agreement
 */
export const uploadEngagementAgreement = async (customerId, file) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) return { success: false, error: 'Use image or PDF' };
    const path = `documents/${user.uid}/engagement_${customerId}_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await updateCustomer(customerId, { engagementAgreementUrl: url });
    return { success: true, url };
  } catch (error) {
    console.error('Upload engagement agreement error:', error);
    return { success: false, error: 'Upload failed' };
  }
};

/**
 * Get all customers for current user (no composite index required)
 */
export const getCustomers = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const customersRef = collection(db, 'customers');
    const q = query(customersRef, where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    const customers = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return { success: true, data: customers };
  } catch (error) {
    console.error('Get customers error:', error);
    return { success: false, error: 'Failed to retrieve customers', data: [] };
  }
};

/**
 * Get single customer by ID
 */
export const getCustomer = async (customerId) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    if (!customerDoc.exists()) return { success: false, error: 'Customer not found' };
    const data = customerDoc.data();
    if (data.userId !== user.uid) return { success: false, error: 'Unauthorized' };

    return { success: true, data: { id: customerDoc.id, ...data } };
  } catch (error) {
    console.error('Get customer error:', error);
    return { success: false, error: 'Failed to retrieve customer' };
  }
};

/**
 * Delete customer
 */
export const deleteCustomer = async (customerId) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    if (!customerDoc.exists()) return { success: false, error: 'Customer not found' };
    if (customerDoc.data().userId !== user.uid) return { success: false, error: 'Unauthorized' };

    await deleteDoc(customerRef);
    return { success: true, message: 'Customer deleted successfully' };
  } catch (error) {
    console.error('Delete customer error:', error);
    return { success: false, error: 'Failed to delete customer' };
  }
};

/**
 * Search customers by name or email
 */
export const searchCustomers = async (searchTerm) => {
  try {
    const result = await getCustomers();
    if (!result.success || !result.data) return result;
    const lower = (searchTerm || '').toLowerCase();
    const filtered = result.data.filter(
      (c) =>
        (c.customerName && c.customerName.toLowerCase().includes(lower)) ||
        (c.customerEmail && c.customerEmail.toLowerCase().includes(lower)) ||
        (c.payorEmail && c.payorEmail.toLowerCase().includes(lower))
    );
    return { success: true, data: filtered };
  } catch (error) {
    return { success: false, error: 'Search failed' };
  }
};

export const getAllCustomers = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
      return { success: false, error: 'Unauthorized. Admin access required.' };
    }
    const snapshot = await getDocs(collection(db, 'customers'));
    const customers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, data: customers };
  } catch (error) {
    console.error('Get all customers error:', error);
    return { success: false, error: 'Failed to retrieve customers' };
  }
};
