import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, Pencil, Calendar, Trash2, Mail, LayoutDashboard } from 'lucide-react';
import { getCustomers, deleteCustomer } from '../../services/customerService';
import { sendEmail } from '../../services/emailService';

function CustomerList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const result = await getCustomers();
    if (result.success) setCustomers(result.data || []);
    else setError(result.error);
    setLoading(false);
  };

  const [sendingTo, setSendingTo] = useState(null);

  const sendSignupLink = async (c) => {
    const email = c.payorEmail || c.customerEmail;
    if (!email) {
      alert('No email on file for this customer. Add payor/customer email first.');
      return;
    }
    setSendingTo(email);
    const base = window.location.origin;
    const link = `${base}/register-customer?email=${encodeURIComponent(email)}`;
    const subject = 'Sign up for the e-invoicing platform';
    const text = `You have been invited to sign up as a Customer/Payor on the e-invoicing platform.\n\nSign up here: ${link}\n\nAfter signing up you can view and accept invoices, and manage your profile.`;
    const res = await sendEmail({ to: email, subject, text });
    setSendingTo(null);
    if (res.success) alert('Sign-up link sent successfully!');
    else alert(res.error || 'Failed to send email.');
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete customer "${name}"?`)) return;
    const result = await deleteCustomer(id);
    if (result.success) loadCustomers();
    else setError(result.error);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e0e0e0', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        Loading customers...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Customers / patients</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#f0f0f0', color: '#333', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button
            onClick={() => navigate('/customers/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
          >
            <UserPlus size={20} /> Add customer
          </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>
        )}

        {customers.length === 0 ? (
          <div style={{ background: 'white', padding: '48px', borderRadius: '12px', textAlign: 'center', color: '#666' }}>
            <User size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ marginBottom: '16px' }}>No customers yet. Add one to get started.</p>
            <button onClick={() => navigate('/customers/new')} style={{ padding: '12px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              Add customer
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {customers.map((c) => (
              <div
                key={c.id}
                style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
              >
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>{c.customerName}</div>
                  {c.serviceAddress && <div style={{ fontSize: '14px', color: '#666' }}>{c.serviceAddress}</div>}
                  {c.customerEmail && <div style={{ fontSize: '13px', color: '#888' }}>{c.customerEmail}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => sendSignupLink(c)}
                    disabled={sendingTo === (c.payorEmail || c.customerEmail)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#f0fdfa', color: '#0d9488', border: '1px solid #0d9488', borderRadius: '6px', cursor: sendingTo ? 'wait' : 'pointer', fontSize: '14px', opacity: sendingTo ? 0.7 : 1 }}
                  >
                    <Mail size={16} /> {sendingTo === (c.payorEmail || c.customerEmail) ? 'Sending...' : 'Send sign-up link'}
                  </button>
                  <button onClick={() => navigate(`/schedule?customerId=${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <Calendar size={16} /> Schedule
                  </button>
                  <button onClick={() => navigate(`/customers/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#f5f5f5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <Pencil size={16} /> Edit
                  </button>
                  <button onClick={() => handleDelete(c.id, c.customerName)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default CustomerList;
