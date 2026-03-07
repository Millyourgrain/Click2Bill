import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function HomeRedirect() {
  const { currentUser, userRole } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  const role = userRole || 'worker';
  return <Navigate to={role === 'customer' ? '/customer-dashboard' : '/dashboard'} replace />;
}

export default HomeRedirect;
