import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RoleSelect from '../auth/RoleSelect';

/**
 * "/" route: not logged in → Role Select (flowchart). Logged in → redirect to role-specific dashboard.
 */
function LandingOrRedirect() {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e0e0e0', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (currentUser) {
    const role = userRole || 'worker';
    return <Navigate to={role === 'customer' ? '/customer-dashboard' : '/dashboard'} replace />;
  }

  return <RoleSelect />;
}

export default LandingOrRedirect;
