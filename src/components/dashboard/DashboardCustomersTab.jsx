import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText } from 'lucide-react';
import { getCustomers } from '../../services/customerService';
import { getInvoices } from '../../services/invoiceService';

function invoiceMatchesCustomer(inv, customer) {
  if (!customer?.id) return false;
  if (inv.customerId && inv.customerId === customer.id) return true;
  const ce = (inv.customerEmail || '').trim().toLowerCase();
  const fe = (customer.customerEmail || '').trim().toLowerCase();
  if (fe && ce === fe) return true;
  return false;
}

function DashboardCustomersTab() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const [cRes, iRes] = await Promise.all([getCustomers(), getInvoices()]);
      if (cancelled) return;
      if (!cRes.success) setError(cRes.error || 'Could not load customers');
      else setCustomers(cRes.data || []);
      if (iRes.success) setInvoices(iRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    return customers.map((c) => {
      const matched = invoices.filter((inv) => invoiceMatchesCustomer(inv, c));
      const invoiceCount = matched.length;
      const totalBilled = matched.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
      return { customer: c, invoiceCount, totalBilled };
    }).sort((a, b) => (b.invoiceCount - a.invoiceCount) || a.customer.customerName.localeCompare(b.customer.customerName));
  }, [customers, invoices]);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#666' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 12px' }} />
        Loading customers…
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: '#eef2ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} color="#4f46e5" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Customers</h2>
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0', maxWidth: '520px' }}>
              Billing profiles saved from invoices (and the customer list). Totals include all invoices linked by saved customer ID or matching email.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/invoice')}
          style={{
            padding: '10px 18px',
            background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-700) 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileText size={18} /> New invoice
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: '#666', fontSize: '15px', margin: 0 }}>
          No saved customers yet. When you generate an invoice with a customer name and email, a record is created automatically (or add one under the full customer list).
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '12px 10px', fontWeight: '600', color: '#374151' }}>Customer</th>
                <th style={{ padding: '12px 10px', fontWeight: '600', color: '#374151' }}>Email</th>
                <th style={{ padding: '12px 10px', fontWeight: '600', color: '#374151' }}>Service address</th>
                <th style={{ padding: '12px 10px', fontWeight: '600', color: '#374151', textAlign: 'right' }}>Invoices</th>
                <th style={{ padding: '12px 10px', fontWeight: '600', color: '#374151', textAlign: 'right' }}>Total billed</th>
                <th style={{ padding: '12px 10px', fontWeight: '600', color: '#374151' }}> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ customer: c, invoiceCount, totalBilled }) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '14px 10px', fontWeight: '600' }}>
                    {c.customerName || '—'}
                    {c.isRecurring && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '600', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '999px' }}>Recurring</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 10px', color: '#4b5563' }}>{c.customerEmail || '—'}</td>
                  <td style={{ padding: '14px 10px', color: '#6b7280', maxWidth: '240px' }}>{c.serviceAddress ? <span style={{ whiteSpace: 'pre-wrap' }}>{c.serviceAddress}</span> : '—'}</td>
                  <td style={{ padding: '14px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{invoiceCount}</td>
                  <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>${totalBilled.toFixed(2)}</td>
                  <td style={{ padding: '14px 10px' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/invoice?customerId=${encodeURIComponent(c.id)}`)}
                      style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#4f46e5' }}
                    >
                      Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '20px', marginBottom: 0 }}>
        Open the <button type="button" onClick={() => navigate('/customers')} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontWeight: '600', padding: 0 }}>full customer list</button> to edit profiles, schedule visits, or send sign-up links.
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default DashboardCustomersTab;
