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

/**
 * Save a new invoice
 */
export const saveInvoice = async (invoiceData) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const invoicesRef = collection(db, 'invoices');
    
    const newInvoice = {
      userId: user.uid,
      invoiceNumber: invoiceData.invoiceNumber,
      date: invoiceData.date,
      dueDate: invoiceData.dueDate || null,
      
      // Company info (from company profile)
      companyName: invoiceData.companyName,
      companyAddress: invoiceData.companyAddress || '',
      companyLogo: invoiceData.companyLogo || '',
      gstNumber: invoiceData.gstNumber || '',
      
      // Customer info
      customerName: invoiceData.customerName,
      customerEmail: invoiceData.customerEmail,
      serviceAddress: invoiceData.serviceAddress || '',
      
      // Line items
      items: invoiceData.items || [],
      
      // Travel items (tax-exempt)
      travelItems: invoiceData.travelItems || [],
      
      // Calculations
      subtotal: invoiceData.subtotal || 0,
      taxRate: invoiceData.taxRate || 0,
      tax: invoiceData.tax || 0,
      travelTotal: invoiceData.travelTotal || 0,
      total: invoiceData.total || 0,
      
      // Additional info
      notes: invoiceData.notes || '',
      signature: invoiceData.signature || '',
      
      // Status tracking
      status: invoiceData.status || 'draft', // draft, sent, paid, overdue, cancelled
      
      // Timestamps
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
 * Get all invoices for current user
 */
export const getInvoices = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const invoicesRef = collection(db, 'invoices');
    const q = query(
      invoicesRef,
      where('userId', '==', user.uid),
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
    console.error('Get invoices error:', error);
    return {
      success: false,
      error: 'Failed to retrieve invoices'
    };
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
    
    // Verify ownership
    if (invoiceData.userId !== user.uid) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
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
    
    // Verify ownership
    if (invoiceDoc.data().userId !== user.uid) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }
    
    await updateDoc(invoiceRef, {
      ...updates,
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
    
    // Verify ownership
    if (invoiceDoc.data().userId !== user.uid) {
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
    
    const invoicesRef = collection(db, 'invoices');
    const q = query(
      invoicesRef,
      where('userId', '==', user.uid),
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
 * Get invoice statistics for dashboard
 */
export const getInvoiceStats = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, where('userId', '==', user.uid));
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
          sentCount++;
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