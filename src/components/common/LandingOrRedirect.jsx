import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MarketingLanding from '../marketing/MarketingLanding';

/**
 * "/" route: not logged in → marketing landing (free PDF builder + register). Logged in → dashboard by role.
 */
function LandingOrRedirect() {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid var(--cream-mid)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (currentUser) {
    const role = userRole || 'worker';
    return <Navigate to={role === 'customer' ? '/customer-dashboard' : '/dashboard'} replace />;
  }

  return <MarketingLanding />;
}

export default LandingOrRedirect;
