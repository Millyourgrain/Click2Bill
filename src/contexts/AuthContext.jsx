import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getWorkerDashboardPersona } from '../services/workerOrgContext';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          ...userData
        });
        setUserRole(userData.role || 'worker');
      } else {
        setCurrentUser(user);
        setUserRole('worker');
      }
    } catch (err) {
      console.error('Refresh user data error:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              ...userData
            });
            setUserRole(userData.role || 'worker');
          } else {
            setCurrentUser(user);
            setUserRole('worker');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setCurrentUser(user);
          setUserRole('worker');
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const workerDashboardPersona = currentUser
    ? getWorkerDashboardPersona({
        uid: currentUser.uid,
        organizationOwnerId:
          typeof currentUser.organizationOwnerId === 'string' ? currentUser.organizationOwnerId.trim() : '',
        userTeamRole:
          typeof currentUser.userTeamRole === 'string' ? currentUser.userTeamRole.toLowerCase() : '',
      })
    : null;

  const value = {
    currentUser,
    userRole,
    loading,
    refreshUserData,
    workerDashboardPersona,
    isAuthenticated: !!currentUser,
    isAdmin: userRole === 'admin',
    isWorker: userRole === 'worker' || userRole === 'user' || userRole === 'admin',
    isCustomer: userRole === 'customer',
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};