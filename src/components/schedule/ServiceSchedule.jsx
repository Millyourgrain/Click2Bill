import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, LogIn, LogOut, Plus, User, MapPin, LayoutDashboard } from 'lucide-react';
import { getCustomers, getCustomer } from '../../services/customerService';
import { getVisits, createVisit, checkIn, checkOut, updateVisitCheckTimes, getVisitHours, getVisitDays } from '../../services/visitService';

function ServiceSchedule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerIdParam = searchParams.get('customerId');

  const [customers, setCustomers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerIdParam || '');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    setSelectedCustomerId(customerIdParam || selectedCustomerId);
  }, [customerIdParam]);

  useEffect(() => {
    loadVisits();
  }, [selectedCustomerId]);

  useEffect(() => {
    if (selectedCustomerId) {
      getCustomer(selectedCustomerId).then((r) => r.success && setSelectedCustomer(r.data));
    } else {
      setSelectedCustomer(null);
    }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    const result = await getCustomers();
    if (result.success) setCustomers(result.data || []);
    else setError(result.error || 'Could not load customers. Add customers from the Customers page first.');
    setLoading(false);
  };

  const loadVisits = async () => {
    const result = await getVisits(selectedCustomerId ? { customerId: selectedCustomerId } : {});
    if (result.success) setVisits(result.data || []);
    else console.error('Load visits failed:', result.error);
  };

  const handleCreateVisit = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId || !serviceDate) {
      setError('Select customer and service date.');
      return;
    }
    setError('');
    setSuccess('');
    setActionLoading('create');
    const result = await createVisit({
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.customerName || '',
      serviceAddress: selectedCustomer?.serviceAddress || '',
      customerEmail: selectedCustomer?.customerEmail || '',
      payorEmail: selectedCustomer?.isPayorSameAsCustomer ? selectedCustomer?.customerEmail : (selectedCustomer?.payorEmail || selectedCustomer?.customerEmail),
      serviceDate,
    });
    setActionLoading(null);
    if (result.success) {
      setSuccess('Visit scheduled.');
      setServiceDate('');
      setError('');
      loadVisits();
    } else {
      setError(result.error || 'Failed to schedule visit. Please try again.');
    }
  };

  const handleCheckIn = async (visitId) => {
    setActionLoading(visitId);
    setError('');
    const result = await checkIn(visitId);
    setActionLoading(null);
    if (result.success) {
      setSuccess(result.message);
      loadVisits();
    } else setError(result.error);
  };

  const handleCheckOut = async (visitId) => {
    setActionLoading(visitId);
    setError('');
    const result = await checkOut(visitId);
    setActionLoading(null);
    if (result.success) {
      setSuccess(result.message);
      loadVisits();
    } else setError(result.error);
  };

  const handleManualCheckTimes = async (visitId) => {
    setError('');
    if (!manualCheckIn && !manualCheckOut) {
      setError('Enter at least check-in or check-out time.');
      return;
    }
    setActionLoading(visitId);
    const payload = {};
    if (manualCheckIn) payload.checkInTime = manualCheckIn;
    if (manualCheckOut) payload.checkOutTime = manualCheckOut;
    const result = await updateVisitCheckTimes(visitId, payload);
    setActionLoading(null);
    if (result.success) {
      setSuccess('Check times saved.');
      setEditingVisitId(null);
      setManualCheckIn('');
      setManualCheckOut('');
      loadVisits();
    } else setError(result.error);
  };

  const formatTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }) : '–');
  const toDatetimeLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e0e0e0', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Schedule service</h1>
          <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#f0f0f0', color: '#333', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
        </div>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Schedule visits for a date (default: today). Check in/out same day or add times manually. Notifications sent to patient and payor.</p>

        {error && <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}

        {customers.length === 0 && (
          <div style={{ background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No customers yet</div>
            <p style={{ margin: '0 0 12px 0', color: '#856404' }}>Add at least one customer before scheduling a visit.</p>
            <button onClick={() => navigate('/customers/new')} style={{ padding: '10px 20px', background: '#ffc107', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Add customer</button>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>New visit</h2>
          <form onSubmit={handleCreateVisit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ minWidth: '200px', flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Customer *</label>
              <select value={selectedCustomerId} onChange={(e) => { setSelectedCustomerId(e.target.value); setError(''); }} required style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customerName || c.customerEmail || 'Unnamed'}</option>
                ))}
              </select>
              {customers.length === 0 && <span style={{ fontSize: '12px', color: '#c62828', marginTop: '4px', display: 'block' }}>Add a customer first</span>}
            </div>
            <div style={{ minWidth: '160px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Service date</label>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }} />
            </div>
            <button type="submit" disabled={actionLoading === 'create' || customers.length === 0} style={{ padding: '10px 20px', background: (actionLoading === 'create' || customers.length === 0) ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: (actionLoading === 'create' || customers.length === 0) ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Schedule visit
            </button>
          </form>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Visits</h2>
          {visits.length === 0 ? (
            <p style={{ color: '#666' }}>No visits yet. Schedule one above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visits.map((v) => {
                const hours = getVisitHours(v);
                const days = getVisitDays(v);
                const isEditing = editingVisitId === v.id;
                return (
                <div key={v.id} style={{ padding: '16px', border: '1px solid #e0e0e0', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{v.customerName}</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>{v.serviceDate} • {v.serviceAddress}</div>
                    <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                      Check-in: {v.checkInTime ? formatTime(v.checkInTime) : '–'} • Check-out: {v.checkOutTime ? formatTime(v.checkOutTime) : '–'} • {v.status}
                    </div>
                    {v.checkInTime && v.checkOutTime && (
                      <div style={{ fontSize: '14px', color: '#2e7d32', fontWeight: '600', marginTop: '6px' }}>
                        {hours.toFixed(2)} hours • {days.toFixed(2)} days (8h/day)
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!v.checkInTime && !isEditing && (
                      <button onClick={() => handleCheckIn(v.id)} disabled={!!actionLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                        <LogIn size={16} /> Check in (now)
                      </button>
                    )}
                    {v.checkInTime && !v.checkOutTime && !isEditing && (
                      <button onClick={() => handleCheckOut(v.id)} disabled={!!actionLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                        <LogOut size={16} /> Check out (now)
                      </button>
                    )}
                    {(!v.checkInTime || !v.checkOutTime) && !isEditing && (
                      <button onClick={() => { setEditingVisitId(v.id); setManualCheckIn(v.checkInTime ? toDatetimeLocal(v.checkInTime) : (v.serviceDate ? v.serviceDate + 'T09:00' : '')); setManualCheckOut(v.checkOutTime ? toDatetimeLocal(v.checkOutTime) : (v.serviceDate ? v.serviceDate + 'T17:00' : '')); }} style={{ padding: '8px 14px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        Add times manually
                      </button>
                    )}
                    {isEditing && (
                      <div style={{ width: '100%', marginTop: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Check-in</label>
                          <input type="datetime-local" value={manualCheckIn} onChange={(e) => setManualCheckIn(e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Check-out</label>
                          <input type="datetime-local" value={manualCheckOut} onChange={(e) => setManualCheckOut(e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                        <button onClick={() => handleManualCheckTimes(v.id)} disabled={!!actionLoading} style={{ padding: '8px 16px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Save</button>
                        <button onClick={() => { setEditingVisitId(null); setManualCheckIn(''); setManualCheckOut(''); }} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    )}
                    {v.checkInTime && v.checkOutTime && (
                      <span style={{ fontSize: '14px', color: '#2e7d32', fontWeight: '500' }}>Completed</span>
                    )}
                    <button onClick={() => navigate(`/invoice?visitId=${v.id}&customerId=${v.customerId}`)} style={{ padding: '8px 14px', background: '#f5f5f5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                      Create invoice
                    </button>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default ServiceSchedule;
