import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';

/**
 * Landing: companies register here; invoice payors sign in via /login (or invite link to /register-customer).
 */
function RoleSelect() {
  const navigate = useNavigate();

  const cardStyle = {
    padding: '32px 24px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    textAlign: 'center',
    cursor: 'pointer',
    border: '3px solid transparent',
    transition: 'all 0.2s ease',
    maxWidth: '420px',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>
        E-Invoicing Platform
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px', marginBottom: '40px', textAlign: 'center' }}>
        Create invoices and manage your business in one place
      </p>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/register')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/register')}
          style={cardStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#0d9488';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ width: '64px', height: '64px', background: '#ccfbf1', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Building2 size={32} color="#0d9488" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#1a1a1a' }}>Register your company</h2>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Set up your company profile, customers, and invoicing.</p>
        </div>
      </div>

      <p style={{ marginTop: '32px', color: 'rgba(255,255,255,0.85)', fontSize: '14px', textAlign: 'center' }}>
        Already have an account?{' '}
        <a href="/login" style={{ color: 'white', fontWeight: '600' }} onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign in</a>
        {' '}· Paying an invoice? Sign in with the email on your invoice.
      </p>
    </div>
  );
}

export default RoleSelect;
