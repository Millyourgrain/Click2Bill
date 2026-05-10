import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, Pencil, Trash2, LayoutDashboard } from 'lucide-react';
import { getCustomers, deleteCustomer } from '../../services/customerService';

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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete customer "${name}"?`)) return;
    const result = await deleteCustomer(id);
    if (result.success) loadCustomers();
    else setError(result.error);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid var(--cream-mid)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        Loading customers...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Customers</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#f0f0f0', color: '#333', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button
            onClick={() => navigate('/customers/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-700) 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
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
            <button onClick={() => navigate('/customers/new')} style={{ padding: '12px 24px', background: 'var(--navy)', color: 'white', border: '2px solid var(--gold)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
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
                  <button onClick={() => navigate(`/customers/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--cream-dark)', color: 'var(--navy)', border: '1px solid var(--cream-mid)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button onClick={() => handleDelete(c.id, c.customerName)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(185,28,28,0.15)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <Trash2 size={15} />
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
