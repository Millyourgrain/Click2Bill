import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, Users } from 'lucide-react';

/**
 * Landing: User visits platform → Select Role (flowchart step).
 * Independent Worker | Organization/Agency → /register
 * Customer/Payor → /register-customer
 */
function RoleSelect() {
  const navigate = useNavigate();

  const cardStyle = (color) => ({
    padding: '32px 24px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    textAlign: 'center',
    cursor: 'pointer',
    border: '3px solid transparent',
    transition: 'all 0.2s ease',
  });

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
        Select your role to continue
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center', maxWidth: '900px' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/register')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/register')}
          style={cardStyle()}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#667eea';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ width: '64px', height: '64px', background: '#eef2ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <User size={32} color="#667eea" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#1a1a1a' }}>Independent Worker</h2>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>PSW, RPN, RN, or service provider. Register and complete your profile.</p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/register?type=agency')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/register?type=agency')}
          style={cardStyle()}
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
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#1a1a1a' }}>Organization / Agency</h2>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Register your organization. Same registration as worker; identify as agency in profile.</p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/register-customer')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/register-customer')}
          style={cardStyle()}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ width: '64px', height: '64px', background: '#fef3c7', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Users size={32} color="#f59e0b" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#1a1a1a' }}>Customer / Payor</h2>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Receive and pay invoices. Sign up and complete your profile.</p>
        </div>
      </div>

      <p style={{ marginTop: '32px', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
        Already have an account? <a href="/login" style={{ color: 'white', fontWeight: '600' }} onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign in</a>
      </p>
    </div>
  );
}

export default RoleSelect;
