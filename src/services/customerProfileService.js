import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';

const COLLECTION = 'customerProfiles';

/**
 * Save or update Customer/Payor profile (platform profile, not worker's customer record)
 */
export const saveCustomerProfile = async (data) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const docRef = doc(db, COLLECTION, user.uid);
    const existing = await getDoc(docRef);
    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    if (!existing.exists()) {
      await setDoc(docRef, { ...payload, userId: user.uid, createdAt: new Date().toISOString() });
    } else {
      await updateDoc(docRef, payload);
    }
    return { success: true, data: payload };
  } catch (error) {
    console.error('Save customer profile error:', error);
    return { success: false, error: 'Failed to save profile' };
  }
};

/**
 * Get current user's customer profile
 */
export const getCustomerProfile = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    const snap = await getDoc(doc(db, COLLECTION, user.uid));
    if (!snap.exists()) return { success: true, data: null };
    return { success: true, data: snap.data() };
  } catch (error) {
    console.error('Get customer profile error:', error);
    return { success: false, error: 'Failed to load profile' };
  }
};

/**
 * Upload service agreement document
 */
export const uploadServiceAgreement = async (file) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };
    const path = `documents/${user.uid}/service_agreement_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { success: true, url };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
};
