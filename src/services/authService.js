import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

/**
 * Register a new user with company information
 */
export const registerUser = async (userData) => {
  try {
    const { email, password, companyName, fullName, phone } = userData;
    
    // Create authentication user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update user profile with display name
    await updateProfile(user, {
      displayName: fullName
    });
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: email,
      fullName: fullName,
      phone: phone || '',
      companyName: companyName,
      role: 'user', // Can be 'user' or 'admin'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    });
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      }
    };
  } catch (error) {
    console.error('Registration error:', error);
    
    // User-friendly error messages
    let errorMessage = 'Registration failed. Please try again.';
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered. Please login instead.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Login existing user
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      throw new Error('User data not found');
    }
    
    const userData = userDoc.data();
    
    // Check if account is active
    if (!userData.isActive) {
      await signOut(auth);
      return {
        success: false,
        error: 'Your account has been deactivated. Please contact support.'
      };
    }
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        ...userData
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    
    let errorMessage = 'Login failed. Please try again.';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Logout current user
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: 'Logout failed. Please try again.'
    };
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    };
  } catch (error) {
    console.error('Password reset error:', error);
    
    let errorMessage = 'Failed to send reset email.';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Get current user data
 */
export const getCurrentUserData = async () => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      return { success: false, error: 'User data not found' };
    }
    
    return {
      success: true,
      data: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        ...userDoc.data()
      }
    };
  } catch (error) {
    console.error('Get user data error:', error);
    return {
      success: false,
      error: 'Failed to fetch user data'
    };
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (updates) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }
    
    // Update authentication profile if email or displayName changed
    if (updates.displayName) {
      await updateProfile(user, { displayName: updates.displayName });
    }
    
    if (updates.email && updates.email !== user.email) {
      await updateEmail(user, updates.email);
    }
    
    // Update Firestore document
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    console.error('Update profile error:', error);
    
    let errorMessage = 'Failed to update profile';
    
    if (error.code === 'auth/requires-recent-login') {
      errorMessage = 'Please log in again to make this change.';
    } else if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already in use.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Change user password
 */
export const changePassword = async (newPassword) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }
    
    await updatePassword(user, newPassword);
    
    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    console.error('Change password error:', error);
    
    let errorMessage = 'Failed to change password';
    
    if (error.code === 'auth/requires-recent-login') {
      errorMessage = 'Please log in again to change your password.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};