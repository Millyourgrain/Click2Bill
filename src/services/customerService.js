import {
  collection,
  doc,
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
import { getWorkerOrgContext } from './workerOrgContext';

/**
 * Add or update customer profile
 */
export const addCustomer = async (customerData) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const customersRef = collection(db, 'customers');
    const payload = {
      userId: ctx.billingUserId,
      entityType: customerData.entityType || 'individual',
      businessName: customerData.businessName || '',
      customerName: customerData.customerName || '',
      serviceAddress: customerData.serviceAddress || '',
      customerEmail: customerData.customerEmail || '',
      customerPhone: customerData.customerPhone || '',
      isPayorSameAsCustomer: customerData.isPayorSameAsCustomer ?? null,
      payorName: customerData.payorName || '',
      payorRelationship: customerData.payorRelationship || '',
      payorEmail: customerData.payorEmail || '',
      payorPhone: customerData.payorPhone || '',
      sendServiceNotification: customerData.sendServiceNotification ?? false,
      isRecurring: !!customerData.isRecurring,
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
    const ctx = await getWorkerOrgContext();
    if (!ctx || customerDoc.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };

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
    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };
    const path = `documents/${ctx.billingUserId}/engagement_${customerId}_${Date.now()}_${file.name}`;
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

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const customersRef = collection(db, 'customers');
    const q = query(customersRef, where('userId', '==', ctx.billingUserId));
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
    const ctx = await getWorkerOrgContext();
    if (!ctx || data.userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };

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
    const ctx = await getWorkerOrgContext();
    if (!ctx || customerDoc.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };

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
/**
 * Match recurring customer by exact name (case-insensitive) for invoice autofill.
 */
export const findRecurringCustomerByName = async (name) => {
  try {
    const result = await getCustomers();
    if (!result.success || !result.data) return { success: false, error: result.error, data: null };
    const n = (name || '').trim().toLowerCase();
    if (!n) return { success: true, data: null };
    const match = result.data.find(
      (c) => c.isRecurring && (c.customerName || '').trim().toLowerCase() === n
    );
    return { success: true, data: match || null };
  } catch (error) {
    return { success: false, error: 'Lookup failed', data: null };
  }
};

/**
 * Create or update a billing customer from invoice data (org-scoped).
 * Matches by existing customerId, else by customer email.
 */
export const upsertCustomerFromInvoice = async ({
  billingCustomerId,
  customerName,
  customerEmail,
  serviceAddress,
  payorDifferentFromCustomer,
  payorName,
  payorEmail,
  isRecurringCustomer,
}) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const name = (customerName || '').trim();
    const email = (customerEmail || '').trim();
    if (!name || !email) return { success: false, error: 'Customer name and email required' };

    const isPayorSame = !payorDifferentFromCustomer;
    const pName = payorDifferentFromCustomer ? (payorName || '').trim() : '';
    const pEmail = payorDifferentFromCustomer ? (payorEmail || '').trim() : '';

    const patch = {
      customerName: name,
      customerEmail: email,
      serviceAddress: (serviceAddress || '').trim(),
      isPayorSameAsCustomer: isPayorSame,
      payorName: pName,
      payorEmail: isPayorSame ? '' : pEmail,
      payorRelationship: '',
      isRecurring: !!isRecurringCustomer,
      updatedAt: new Date().toISOString(),
    };

    if (billingCustomerId) {
      const customerRef = doc(db, 'customers', billingCustomerId);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists() && customerDoc.data().userId === ctx.billingUserId) {
        await updateDoc(customerRef, patch);
        return { success: true, data: { id: billingCustomerId } };
      }
    }

    const customersRef = collection(db, 'customers');
    const q = query(customersRef, where('userId', '==', ctx.billingUserId));
    const snapshot = await getDocs(q);
    const emailKey = email.toLowerCase();
    const byEmail = snapshot.docs.find(
      (d) => (d.data().customerEmail || '').trim().toLowerCase() === emailKey
    );

    if (byEmail) {
      await updateDoc(byEmail.ref, patch);
      return { success: true, data: { id: byEmail.id } };
    }

    const newPayload = {
      userId: ctx.billingUserId,
      entityType: 'individual',
      businessName: '',
      customerPhone: '',
      payorPhone: '',
      sendServiceNotification: false,
      ...patch,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(customersRef, newPayload);
    return { success: true, data: { id: docRef.id } };
  } catch (error) {
    console.error('upsertCustomerFromInvoice error:', error);
    return { success: false, error: 'Failed to save customer record' };
  }
};

export const searchCustomers = async (searchTerm) => {
  try {
    const result = await getCustomers();
    if (!result.success || !result.data) return result;
    const lower = (searchTerm || '').toLowerCase();
    const filtered = result.data.filter(
      (c) =>
        (c.customerName && c.customerName.toLowerCase().includes(lower)) ||
        (c.businessName && c.businessName.toLowerCase().includes(lower)) ||
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
