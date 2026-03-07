import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ProtectedRoute – requires auth. Optionally restrict by role (worker vs customer).
 * @param {React.ReactNode} children
 * @param {string[]} [allowedRoles] – e.g. ['worker'] or ['customer']. If omitted, any authenticated user can access.
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', border: '4px solid #e0e0e0', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#666', fontSize: '16px' }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;

  const role = userRole || 'worker';
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'customer' ? '/customer-dashboard' : '/dashboard'} replace />;
  }

  return children;
}

export default ProtectedRoute;