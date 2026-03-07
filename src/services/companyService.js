import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';

/**
 * Save or update worker/company profile (full PSW profile)
 */
export const saveCompanyInfo = async (companyData) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const companyRef = doc(db, 'companies', user.uid);
    const companyDoc = await getDoc(companyRef);

    const dataToSave = {
      userId: user.uid,
      // Basic
      companyName: companyData.companyName || '',
      legalBusinessName: companyData.legalBusinessName || companyData.companyName || '',
      operationalNameDba: companyData.operationalNameDba || '',
      companyAddress: companyData.companyAddress || '',
      email: companyData.email || user.email,
      phone: companyData.phone || '',
      logoUrl: companyData.logoUrl || '',
      // Business structure (when working independently)
      workingIndependently: companyData.workingIndependently ?? null,
      businessStructure: companyData.businessStructure || '',
      articlesOfIncorporationUrl: companyData.articlesOfIncorporationUrl || '',
      // Personal
      name: companyData.name || '',
      dateOfBirth: companyData.dateOfBirth || '',
      provincialFederalId: companyData.provincialFederalId || '',
      roleTypeOfService: companyData.roleTypeOfService || '',
      roleTypeOther: companyData.roleTypeOther || '',
      // Tax & payment
      gstNumber: companyData.gstNumber || '',
      bankingDetailsUrl: companyData.bankingDetailsUrl || '',
      // Insurance
      commercialLiabilityInsurance: companyData.commercialLiabilityInsurance ?? null,
      commercialLiabilityPolicyUrl: companyData.commercialLiabilityPolicyUrl || '',
      commercialLiabilityInterested: companyData.commercialLiabilityInterested ?? null,
      generalLiabilityInsurance: companyData.generalLiabilityInsurance ?? null,
      generalLiabilityPolicyUrl: companyData.generalLiabilityPolicyUrl || '',
      generalLiabilityInterested: companyData.generalLiabilityInterested ?? null,
      insuranceAcknowledgement: companyData.insuranceAcknowledgement || false,
      // WSIB
      wsibCoverage: companyData.wsibCoverage || '',
      // Travel
      quoteTravelCostOnInvoice: companyData.quoteTravelCostOnInvoice ?? null,
      vehicleDetails: companyData.vehicleDetails || null,
      updatedAt: new Date().toISOString(),
    };

    if (companyDoc.exists()) {
      await updateDoc(companyRef, dataToSave);
    } else {
      await setDoc(companyRef, { ...dataToSave, createdAt: new Date().toISOString() });
    }

    return { success: true, message: 'Profile saved successfully', data: dataToSave };
  } catch (error) {
    console.error('Save company error:', error);
    return { success: false, error: 'Failed to save profile' };
  }
};

/**
 * Get company/worker profile for current user
 */
export const getCompanyInfo = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const companyRef = doc(db, 'companies', user.uid);
    const companyDoc = await getDoc(companyRef);

    if (!companyDoc.exists()) {
      return { success: true, data: null, message: 'No profile found' };
    }
    return { success: true, data: companyDoc.data() };
  } catch (error) {
    console.error('Get company error:', error);
    return { success: false, error: 'Failed to retrieve profile' };
  }
};

/**
 * Upload file to storage (logo, void cheque, insurance, etc.)
 */
const uploadFile = async (file, folder, filenamePrefix) => {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'User not authenticated' };

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Use image or PDF.' };
  }
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) return { success: false, error: 'File too large (max 10MB)' };

  const filename = `${filenamePrefix}_${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `${folder}/${user.uid}/${filename}`);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return { success: true, url: downloadURL, path: `${folder}/${user.uid}/${filename}` };
};

/**
 * Upload company logo
 */
export const uploadCompanyLogo = async (file) => {
  const result = await uploadFile(file, 'logos', 'logo');
  if (!result.success) return result;
  const user = auth.currentUser;
  const companyRef = doc(db, 'companies', user.uid);
  await updateDoc(companyRef, {
    logoUrl: result.url,
    logoPath: result.path,
    updatedAt: new Date().toISOString(),
  });
  return { success: true, url: result.url, message: 'Logo uploaded successfully' };
};

/**
 * Upload articles of incorporation
 */
export const uploadArticlesOfIncorporation = async (file) => {
  const result = await uploadFile(file, 'documents', 'articles');
  if (!result.success) return result;
  const user = auth.currentUser;
  const companyRef = doc(db, 'companies', user.uid);
  await updateDoc(companyRef, {
    articlesOfIncorporationUrl: result.url,
    articlesOfIncorporationPath: result.path,
    updatedAt: new Date().toISOString(),
  });
  return { success: true, url: result.url, message: 'Document uploaded' };
};

/**
 * Upload void cheque / direct deposit form
 */
export const uploadBankingDetails = async (file) => {
  const result = await uploadFile(file, 'documents', 'banking');
  if (!result.success) return result;
  const user = auth.currentUser;
  const companyRef = doc(db, 'companies', user.uid);
  await updateDoc(companyRef, {
    bankingDetailsUrl: result.url,
    bankingDetailsPath: result.path,
    updatedAt: new Date().toISOString(),
  });
  return { success: true, url: result.url, message: 'Banking details uploaded' };
};

/**
 * Upload commercial liability insurance policy
 */
export const uploadCommercialLiabilityPolicy = async (file) => {
  const result = await uploadFile(file, 'documents', 'commercial_liability');
  if (!result.success) return result;
  const user = auth.currentUser;
  const companyRef = doc(db, 'companies', user.uid);
  await updateDoc(companyRef, {
    commercialLiabilityPolicyUrl: result.url,
    commercialLiabilityPolicyPath: result.path,
    updatedAt: new Date().toISOString(),
  });
  return { success: true, url: result.url, message: 'Policy uploaded' };
};

/**
 * Upload general liability insurance policy
 */
export const uploadGeneralLiabilityPolicy = async (file) => {
  const result = await uploadFile(file, 'documents', 'general_liability');
  if (!result.success) return result;
  const user = auth.currentUser;
  const companyRef = doc(db, 'companies', user.uid);
  await updateDoc(companyRef, {
    generalLiabilityPolicyUrl: result.url,
    generalLiabilityPolicyPath: result.path,
    updatedAt: new Date().toISOString(),
  });
  return { success: true, url: result.url, message: 'Policy uploaded' };
};

/**
 * Delete company logo
 */
export const deleteCompanyLogo = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const companyRef = doc(db, 'companies', user.uid);
    const companyDoc = await getDoc(companyRef);
    if (!companyDoc.exists() || !companyDoc.data().logoPath) {
      return { success: false, error: 'No logo to delete' };
    }
    const storageRef = ref(storage, companyDoc.data().logoPath);
    await deleteObject(storageRef);
    await updateDoc(companyRef, { logoUrl: '', logoPath: '', updatedAt: new Date().toISOString() });
    return { success: true, message: 'Logo deleted' };
  } catch (error) {
    console.error('Delete logo error:', error);
    return { success: false, error: 'Failed to delete logo' };
  }
};

/**
 * Get all companies (Admin only)
 */
export const getAllCompanies = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
      return { success: false, error: 'Unauthorized. Admin access required.' };
    }
    const querySnapshot = await getDocs(collection(db, 'companies'));
    const companies = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, data: companies };
  } catch (error) {
    console.error('Get all companies error:', error);
    return { success: false, error: 'Failed to retrieve companies' };
  }
};
