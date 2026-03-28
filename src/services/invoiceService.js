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
  orderBy,
  addDoc 
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { getWorkerOrgContext, canActAsInvoiceMaker, canActAsInvoiceChecker } from './workerOrgContext';

/**
 * Save a new invoice (scoped to org billing userId = company owner uid)
 */
export const saveInvoice = async (invoiceData) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const invoicesRef = collection(db, 'invoices');

    const newInvoice = {
      userId: ctx.billingUserId,
      createdByUid: ctx.uid,
      approvalState: invoiceData.approvalState || 'draft',
      invoiceNumber: invoiceData.invoiceNumber,
      date: invoiceData.date,
      dueDate: invoiceData.dueDate || null,
      serviceStartDate: invoiceData.serviceStartDate || null,
      serviceEndDate: invoiceData.serviceEndDate || null,
      visitId: invoiceData.visitId || null,
      customerId: invoiceData.customerId || null,
      servicePeriodVisits: invoiceData.servicePeriodVisits || [],

      // Company info (from profile: legal name, DBA, logo, address, HST)
      companyName: invoiceData.companyName,
      legalBusinessName: invoiceData.legalBusinessName || invoiceData.companyName,
      operationalNameDba: invoiceData.operationalNameDba || '',
      companyAddress: invoiceData.companyAddress || '',
      companyLogo: invoiceData.companyLogo || '',
      gstNumber: invoiceData.gstNumber || '',

      // Customer info
      customerName: invoiceData.customerName,
      customerEmail: invoiceData.customerEmail,
      serviceAddress: invoiceData.serviceAddress || '',
      isPayorDifferentFromCustomer: !!invoiceData.isPayorDifferentFromCustomer,
      payorName: invoiceData.payorName || '',
      payorEmail: invoiceData.payorEmail || invoiceData.customerEmail,

      // Line items
      items: invoiceData.items || [],
      travelItems: invoiceData.travelItems || [],
      hoursWorked: invoiceData.hoursWorked || null,
      ratePerHour: invoiceData.ratePerHour || null,

      // Calculations
      subtotal: invoiceData.subtotal || 0,
      taxRate: invoiceData.taxRate || 0,
      tax: invoiceData.tax || 0,
      travelTotal: invoiceData.travelTotal || 0,
      total: invoiceData.total || 0,

      // Additional
      notes: invoiceData.notes || '',
      signature: invoiceData.signature || '',
      deliveryMethod: invoiceData.deliveryMethod || null,
      reminderEnabled: invoiceData.reminderEnabled || false,
      reminderFrequency: invoiceData.reminderFrequency || null,
      customerCommentary: invoiceData.customerCommentary || null,
      acceptedAt: invoiceData.acceptedAt || null,
      paidAt: invoiceData.paidAt || null,
      paymentMethod: invoiceData.paymentMethod || null,

      // Status: draft | sent | viewed | accepted | contested | paid | overdue | cancelled
      status: invoiceData.status || 'draft',

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(invoicesRef, newInvoice);
    
    return {
      success: true,
      message: 'Invoice saved successfully',
      data: {
        id: docRef.id,
        ...newInvoice
      }
    };
  } catch (error) {
    console.error('Save invoice error:', error);
    return {
      success: false,
      error: 'Failed to save invoice'
    };
  }
};

/**
 * Get all invoices for current user (no composite index required; sort in memory)
 */
export const getInvoices = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, where('userId', '==', ctx.billingUserId));
    const querySnapshot = await getDocs(q);
    const invoices = querySnapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return { success: true, data: invoices };
  } catch (error) {
    console.error('Get invoices error:', error);
    return { success: false, error: 'Failed to retrieve invoices', data: [] };
  }
};

/**
 * Get invoices for Customer/Payor (where customerEmail or payorEmail matches current user email)
 */
export const getInvoicesForCustomer = async () => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) return { success: false, error: 'User not authenticated' };

    const invoicesRef = collection(db, 'invoices');
    const byCustomer = query(invoicesRef, where('customerEmail', '==', user.email), orderBy('createdAt', 'desc'));
    const byPayor = query(invoicesRef, where('payorEmail', '==', user.email), orderBy('createdAt', 'desc'));

    const [snap1, snap2] = await Promise.all([getDocs(byCustomer), getDocs(byPayor)]);
    const seen = new Set();
    const invoices = [];
    [...snap1.docs, ...snap2.docs].forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      invoices.push({ id: d.id, ...d.data() });
    });
    invoices.sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt)));
    return { success: true, data: invoices };
  } catch (error) {
    console.error('Get invoices for customer error:', error);
    return { success: false, error: 'Failed to retrieve invoices', data: [] };
  }
};

/**
 * Get a single invoice by ID
 */
export const getInvoice = async (invoiceId) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    
    if (!invoiceDoc.exists()) {
      return {
        success: false,
        error: 'Invoice not found'
      };
    }
    
    const invoiceData = invoiceDoc.data();
    const ctx = await getWorkerOrgContext();
    if (!ctx || invoiceData.userId !== ctx.billingUserId) {
      return { success: false, error: 'Unauthorized access' };
    }

    return {
      success: true,
      data: {
        id: invoiceDoc.id,
        ...invoiceData
      }
    };
  } catch (error) {
    console.error('Get invoice error:', error);
    return {
      success: false,
      error: 'Failed to retrieve invoice'
    };
  }
};

/**
 * Get invoice for Customer/Payor (allowed if customerEmail or payorEmail matches current user)
 */
export const getInvoiceForCustomer = async (invoiceId) => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) return { success: false, error: 'User not authenticated' };

    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    if (!invoiceDoc.exists()) return { success: false, error: 'Invoice not found' };

    const data = invoiceDoc.data();
    const isRecipient = (data.customerEmail && data.customerEmail.toLowerCase() === user.email.toLowerCase()) ||
      (data.payorEmail && data.payorEmail.toLowerCase() === user.email.toLowerCase());
    if (!isRecipient) return { success: false, error: 'Unauthorized' };

    return { success: true, data: { id: invoiceDoc.id, ...data } };
  } catch (error) {
    console.error('Get invoice for customer error:', error);
    return { success: false, error: 'Failed to load invoice' };
  }
};

/**
 * Update an existing invoice
 */
export const updateInvoice = async (invoiceId, updates) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    
    if (!invoiceDoc.exists()) {
      return {
        success: false,
        error: 'Invoice not found'
      };
    }
    
    const ctx = await getWorkerOrgContext();
    if (!ctx || invoiceDoc.data().userId !== ctx.billingUserId) {
      return { success: false, error: 'Unauthorized access' };
    }

    await updateDoc(invoiceRef, {
      ...updates,
      lastUpdatedByUid: ctx.uid,
      updatedAt: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Invoice updated successfully'
    };
  } catch (error) {
    console.error('Update invoice error:', error);
    return {
      success: false,
      error: 'Failed to update invoice'
    };
  }
};

/**
 * Delete an invoice
 */
export const deleteInvoice = async (invoiceId) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    
    if (!invoiceDoc.exists()) {
      return {
        success: false,
        error: 'Invoice not found'
      };
    }
    
    const ctx = await getWorkerOrgContext();
    if (!ctx || invoiceDoc.data().userId !== ctx.billingUserId) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }
    
    await deleteDoc(invoiceRef);
    
    return {
      success: true,
      message: 'Invoice deleted successfully'
    };
  } catch (error) {
    console.error('Delete invoice error:', error);
    return {
      success: false,
      error: 'Failed to delete invoice'
    };
  }
};

/**
 * Get invoices by status
 */
export const getInvoicesByStatus = async (status) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const invoicesRef = collection(db, 'invoices');
    const q = query(
      invoicesRef,
      where('userId', '==', ctx.billingUserId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const invoices = [];
    querySnapshot.forEach((doc) => {
      invoices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      data: invoices
    };
  } catch (error) {
    console.error('Get invoices by status error:', error);
    return {
      success: false,
      error: 'Failed to retrieve invoices'
    };
  }
};

/**
 * Get all invoices (Admin only)
 */
export const getAllInvoices = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Check if user is admin
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.'
      };
    }
    
    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const invoices = [];
    querySnapshot.forEach((doc) => {
      invoices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      data: invoices
    };
  } catch (error) {
    console.error('Get all invoices error:', error);
    return {
      success: false,
      error: 'Failed to retrieve invoices'
    };
  }
};

/**
 * Update invoice status (e.g. viewed, accepted, contested, paid)
 */
export const updateInvoiceStatus = async (invoiceId, updates) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    if (!invoiceDoc.exists()) return { success: false, error: 'Invoice not found' };
    const ctx = await getWorkerOrgContext();
    if (!ctx || invoiceDoc.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };
    await updateDoc(invoiceRef, { ...updates, updatedAt: new Date().toISOString() });
    return { success: true, message: 'Updated' };
  } catch (error) {
    console.error('Update invoice status error:', error);
    return { success: false, error: 'Failed to update' };
  }
};

/**
 * Get account receivables with ageing (invoices sent/presented, not yet paid)
 * Uses getInvoices and filters in memory to avoid composite index
 */
export const getAccountReceivables = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const res = await getInvoices();
    if (!res.success || !res.data) return { success: false, error: 'Failed to load invoices' };
    const arStatuses = ['sent', 'accepted', 'viewed'];
    const combined = (res.data || []).filter((i) => arStatuses.includes(i.status));
    const now = new Date();
    const receivables = combined.map((inv) => {
      const due = inv.dueDate ? new Date(inv.dueDate) : now;
      const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
      let ageing = 'current';
      if (daysOverdue > 90) ageing = '90+';
      else if (daysOverdue > 60) ageing = '60-90';
      else if (daysOverdue > 30) ageing = '30-60';
      else if (daysOverdue > 0) ageing = '1-30';
      return { ...inv, daysOverdue, ageing };
    });
    const byAgeing = { '1-30': [], '30-60': [], '60-90': [], '90+': [], current: [] };
    receivables.forEach((r) => {
      if (byAgeing[r.ageing]) byAgeing[r.ageing].push(r);
    });
    const totalOutstanding = receivables.reduce((sum, r) => sum + (r.total || 0), 0);
    return {
      success: true,
      data: receivables,
      byAgeing,
      totalOutstanding,
    };
  } catch (error) {
    console.error('Get receivables error:', error);
    return { success: false, error: 'Failed to get receivables' };
  }
};

/**
 * Get invoice statistics for dashboard
 */
export const getInvoiceStats = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const ctx = await getWorkerOrgContext();
    if (!ctx) return { success: false, error: 'User not authenticated' };

    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, where('userId', '==', ctx.billingUserId));
    const querySnapshot = await getDocs(q);

    let totalRevenue = 0;
    let paidRevenue = 0;
    let unpaidRevenue = 0;
    let draftCount = 0;
    let sentCount = 0;
    let paidCount = 0;
    let overdueCount = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const total = data.total || 0;
      
      totalRevenue += total;
      
      switch (data.status) {
        case 'draft':
          draftCount++;
          break;
        case 'sent':
        case 'viewed':
          sentCount++;
          unpaidRevenue += total;
          break;
        case 'accepted':
          unpaidRevenue += total;
          break;
        case 'paid':
          paidCount++;
          paidRevenue += total;
          break;
        case 'overdue':
          overdueCount++;
          unpaidRevenue += total;
          break;
        default:
          break;
      }
    });
    
    return {
      success: true,
      data: {
        totalInvoices: querySnapshot.size,
        totalRevenue,
        paidRevenue,
        unpaidRevenue,
        draftCount,
        sentCount,
        paidCount,
        overdueCount
      }
    };
  } catch (error) {
    console.error('Get invoice stats error:', error);
    return {
      success: false,
      error: 'Failed to retrieve statistics'
    };
  }
};

/**
 * Get cash collected (paid invoices) - measured when worker marks receivable as money received
 */
export const getCashCollected = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const res = await getInvoices();
    if (!res.success || !res.data) return { success: true, totalCollected: 0, byMethod: {}, data: [] };
    const paid = (res.data || []).filter((i) => i.status === 'paid');
    const totalCollected = paid.reduce((s, i) => s + (i.total || 0), 0);
    const byMethod = { cash: 0, interac: 0, eft_pad: 0, other: 0 };
    paid.forEach((inv) => {
      const amt = inv.total || 0;
      const m = (inv.paymentMethod || 'other').toLowerCase();
      if (m === 'cash') byMethod.cash += amt;
      else if (m === 'interac') byMethod.interac += amt;
      else if (m === 'eft_pad' || m === 'eft/pad') byMethod.eft_pad += amt;
      else byMethod.other += amt;
    });
    return { success: true, totalCollected, byMethod, data: paid };
  } catch (error) {
    console.error('Get cash collected error:', error);
    return { success: false, totalCollected: 0, byMethod: {}, data: [] };
  }
};

/** Maker: submit draft for checker approval */
export const submitInvoiceForApproval = async (invoiceId) => {
  const ref = doc(db, 'invoices', invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, error: 'Invoice not found' };
  const ctx = await getWorkerOrgContext();
  if (!ctx || snap.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };
  if (!canActAsInvoiceMaker(ctx)) return { success: false, error: 'Only a Maker or Admin can submit for approval.' };
  await updateDoc(ref, {
    approvalState: 'pending_checker',
    submittedForApprovalAt: new Date().toISOString(),
    lastUpdatedByUid: ctx.uid,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
};

/** Checker: approve (before send) */
export const approveInvoiceAsChecker = async (invoiceId) => {
  const ref = doc(db, 'invoices', invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, error: 'Invoice not found' };
  const ctx = await getWorkerOrgContext();
  if (!ctx || snap.data().userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };
  await updateDoc(ref, {
    approvalState: 'approved',
    checkerApprovedAt: new Date().toISOString(),
    lastUpdatedByUid: ctx.uid,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
};

/** Checker / org: issue to customer (mark sent) */
export const issueInvoiceToCustomer = async (invoiceId) => {
  const ref = doc(db, 'invoices', invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, error: 'Invoice not found' };
  const data = snap.data();
  const ctx = await getWorkerOrgContext();
  if (!ctx || data.userId !== ctx.billingUserId) return { success: false, error: 'Unauthorized' };
  if (!canActAsInvoiceChecker(ctx)) return { success: false, error: 'Only a Checker or Admin can issue to the customer.' };
  const a = data.approvalState;
  if (a === 'pending_checker') {
    return { success: false, error: 'Invoice is waiting for checker approval.' };
  }
  await updateDoc(ref, {
    status: 'sent',
    approvalState: 'issued',
    issuedAt: new Date().toISOString(),
    lastUpdatedByUid: ctx.uid,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
};