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
 * Add a new customer
 */
export const addCustomer = async (customerData) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const customersRef = collection(db, 'customers');
    
    const newCustomer = {
      userId: user.uid,
      customerName: customerData.customerName,
      email: customerData.email,
      phone: customerData.phone || '',
      serviceAddress: customerData.serviceAddress || '',
      notes: customerData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(customersRef, newCustomer);
    
    return {
      success: true,
      message: 'Customer added successfully',
      data: {
        id: docRef.id,
        ...newCustomer
      }
    };
  } catch (error) {
    console.error('Add customer error:', error);
    return {
      success: false,
      error: 'Failed to add customer'
    };
  }
};

/**
 * Get all customers for current user
 */
export const getCustomers = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const customersRef = collection(db, 'customers');
    const q = query(
      customersRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const customers = [];
    querySnapshot.forEach((doc) => {
      customers.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      data: customers
    };
  } catch (error) {
    console.error('Get customers error:', error);
    return {
      success: false,
      error: 'Failed to retrieve customers'
    };
  }
};

/**
 * Get a single customer by ID
 */
export const getCustomer = async (customerId) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    
    if (!customerDoc.exists()) {
      return {
        success: false,
        error: 'Customer not found'
      };
    }
    
    const customerData = customerDoc.data();
    
    // Verify ownership
    if (customerData.userId !== user.uid) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }
    
    return {
      success: true,
      data: {
        id: customerDoc.id,
        ...customerData
      }
    };
  } catch (error) {
    console.error('Get customer error:', error);
    return {
      success: false,
      error: 'Failed to retrieve customer'
    };
  }
};

/**
 * Update customer information
 */
export const updateCustomer = async (customerId, updates) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    
    if (!customerDoc.exists()) {
      return {
        success: false,
        error: 'Customer not found'
      };
    }
    
    // Verify ownership
    if (customerDoc.data().userId !== user.uid) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }
    
    await updateDoc(customerRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    return {
      success: true,
      message: 'Customer updated successfully'
    };
  } catch (error) {
    console.error('Update customer error:', error);
    return {
      success: false,
      error: 'Failed to update customer'
    };
  }
};

/**
 * Delete a customer
 */
export const deleteCustomer = async (customerId) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    
    if (!customerDoc.exists()) {
      return {
        success: false,
        error: 'Customer not found'
      };
    }
    
    // Verify ownership
    if (customerDoc.data().userId !== user.uid) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }
    
    await deleteDoc(customerRef);
    
    return {
      success: true,
      message: 'Customer deleted successfully'
    };
  } catch (error) {
    console.error('Delete customer error:', error);
    return {
      success: false,
      error: 'Failed to delete customer'
    };
  }
};

/**
 * Search customers by name or email
 */
export const searchCustomers = async (searchTerm) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const customersRef = collection(db, 'customers');
    const q = query(
      customersRef,
      where('userId', '==', user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    
    const customers = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const searchLower = searchTerm.toLowerCase();
      
      // Filter by name or email
      if (
        data.customerName.toLowerCase().includes(searchLower) ||
        data.email.toLowerCase().includes(searchLower)
      ) {
        customers.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    return {
      success: true,
      data: customers
    };
  } catch (error) {
    console.error('Search customers error:', error);
    return {
      success: false,
      error: 'Failed to search customers'
    };
  }
};

/**
 * Get all customers (Admin only)
 */
export const getAllCustomers = async () => {
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
    
    const customersRef = collection(db, 'customers');
    const querySnapshot = await getDocs(customersRef);
    
    const customers = [];
    querySnapshot.forEach((doc) => {
      customers.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      data: customers
    };
  } catch (error) {
    console.error('Get all customers error:', error);
    return {
      success: false,
      error: 'Failed to retrieve customers'
    };
  }
};