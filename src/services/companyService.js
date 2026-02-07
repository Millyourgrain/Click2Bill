import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';

/**
 * Save or update company information
 */
export const saveCompanyInfo = async (companyData) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const companyRef = doc(db, 'companies', user.uid);
    
    // Check if company already exists
    const companyDoc = await getDoc(companyRef);
    
    const dataToSave = {
      userId: user.uid,
      companyName: companyData.companyName,
      companyAddress: companyData.companyAddress || '',
      email: companyData.email || user.email,
      phone: companyData.phone || '',
      gstNumber: companyData.gstNumber || '',
      logoUrl: companyData.logoUrl || '',
      updatedAt: new Date().toISOString()
    };
    
    if (companyDoc.exists()) {
      // Update existing company
      await updateDoc(companyRef, dataToSave);
    } else {
      // Create new company
      await setDoc(companyRef, {
        ...dataToSave,
        createdAt: new Date().toISOString()
      });
    }
    
    return {
      success: true,
      message: 'Company information saved successfully',
      data: dataToSave
    };
  } catch (error) {
    console.error('Save company error:', error);
    return {
      success: false,
      error: 'Failed to save company information'
    };
  }
};

/**
 * Get company information for current user
 */
export const getCompanyInfo = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const companyRef = doc(db, 'companies', user.uid);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists()) {
      return {
        success: true,
        data: null,
        message: 'No company information found'
      };
    }
    
    return {
      success: true,
      data: companyDoc.data()
    };
  } catch (error) {
    console.error('Get company error:', error);
    return {
      success: false,
      error: 'Failed to retrieve company information'
    };
  }
};

/**
 * Upload company logo
 */
export const uploadCompanyLogo = async (file) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload an image (JPG, PNG, GIF, or WebP)'
      };
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File too large. Maximum size is 5MB'
      };
    }
    
    // Create unique filename
    const timestamp = Date.now();
    const filename = `logo_${timestamp}_${file.name}`;
    const storageRef = ref(storage, `logos/${user.uid}/${filename}`);
    
    // Upload file
    await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    // Update company info with logo URL
    const companyRef = doc(db, 'companies', user.uid);
    await updateDoc(companyRef, {
      logoUrl: downloadURL,
      logoPath: `logos/${user.uid}/${filename}`,
      updatedAt: new Date().toISOString()
    });
    
    return {
      success: true,
      url: downloadURL,
      message: 'Logo uploaded successfully'
    };
  } catch (error) {
    console.error('Upload logo error:', error);
    return {
      success: false,
      error: 'Failed to upload logo'
    };
  }
};

/**
 * Delete company logo
 */
export const deleteCompanyLogo = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get current company info
    const companyRef = doc(db, 'companies', user.uid);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists() || !companyDoc.data().logoPath) {
      return {
        success: false,
        error: 'No logo to delete'
      };
    }
    
    // Delete file from storage
    const logoPath = companyDoc.data().logoPath;
    const storageRef = ref(storage, logoPath);
    await deleteObject(storageRef);
    
    // Remove logo URL from company info
    await updateDoc(companyRef, {
      logoUrl: '',
      logoPath: '',
      updatedAt: new Date().toISOString()
    });
    
    return {
      success: true,
      message: 'Logo deleted successfully'
    };
  } catch (error) {
    console.error('Delete logo error:', error);
    return {
      success: false,
      error: 'Failed to delete logo'
    };
  }
};

/**
 * Get all companies (Admin only)
 */
export const getAllCompanies = async () => {
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
    
    const companiesRef = collection(db, 'companies');
    const querySnapshot = await getDocs(companiesRef);
    
    const companies = [];
    querySnapshot.forEach((doc) => {
      companies.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      data: companies
    };
  } catch (error) {
    console.error('Get all companies error:', error);
    return {
      success: false,
      error: 'Failed to retrieve companies'
    };
  }
};