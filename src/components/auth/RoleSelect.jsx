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
    background: 'var(--white)',
    borderRadius: '16px',
    boxShadow: 'var(--portal-shadow)',
    textAlign: 'center',
    cursor: 'pointer',
    border: '2px solid var(--cream-mid)',
    transition: 'all 0.2s ease',
    maxWidth: '420px',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <h1
        style={{
          color: 'var(--navy)',
          fontSize: '28px',
          fontWeight: '700',
          marginBottom: '8px',
          textAlign: 'center',
        }}
      >
        E-Invoicing Platform
      </h1>
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: '16px',
          marginBottom: '40px',
          textAlign: 'center',
          maxWidth: '440px',
        }}
      >
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
            e.currentTarget.style.borderColor = 'var(--gold)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--cream-mid)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'var(--gold-soft)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid var(--gold)',
            }}
          >
            <Building2 size={32} color="var(--navy)" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--navy)' }}>
            Register your company
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            Set up your company profile, customers, and invoicing.
          </p>
        </div>
      </div>

      <p style={{ marginTop: '32px', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
        Already have an account?{' '}
        <a
          href="/login"
          style={{ color: 'var(--gold-dark)', fontWeight: '600' }}
          onClick={(e) => {
            e.preventDefault();
            navigate('/login');
          }}
        >
          Sign in
        </a>
        {' '}
        · Paying an invoice? Sign in with the email on your invoice.
      </p>
    </div>
  );
}

export default RoleSelect;
