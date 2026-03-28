import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogOut, Building, FileText, TrendingUp, Users, DollarSign, MapPin, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';
import { getCompanyInfo } from '../../services/companyService';
import { getInvoiceStats, getInvoices, getAccountReceivables, getCashCollected, updateInvoiceStatus } from '../../services/invoiceService';
import { getTotalDistanceKm, getTravelRecords } from '../../services/travelRecordService';

/** Worker / Agency dashboard only. Customers are redirected to customer dashboard. */
function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, userRole } = useAuth();

  if (userRole === 'customer') return <Navigate to="/customer-dashboard" replace />;
  const [companyInfo, setCompanyInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [receivables, setReceivables] = useState(null);
  const [cashCollected, setCashCollected] = useState(null);
  const [travelRecords, setTravelRecords] = useState([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingInvoiceId, setMarkingInvoiceId] = useState(null);
  const [showPaymentMethod, setShowPaymentMethod] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleConfirmReceipt = async (invId) => {
    await updateInvoiceStatus(invId, { workerConfirmedReceiptAt: new Date().toISOString() });
    loadDashboardData();
  };

  const loadDashboardData = async () => {
    try {
      const [companyResult, statsResult, invResult, arResult, cashResult, distanceResult] = await Promise.all([
        getCompanyInfo(),
        getInvoiceStats(),
        getInvoices(),
        getAccountReceivables(),
        getCashCollected(),
        getTotalDistanceKm(),
      ]);
      if (companyResult.success) setCompanyInfo(companyResult.data);
      if (statsResult.success) setStats(statsResult.data);
      if (invResult.success) setInvoices(invResult.data?.slice(0, 20) || []);
      if (arResult.success) setReceivables(arResult);
      if (cashResult.success) setCashCollected(cashResult);
      if (distanceResult.success) {
        setTotalDistanceKm(distanceResult.totalKm ?? 0);
        setTravelRecords(distanceResult.data?.slice(0, 15) || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

  const downloadCSV = (rows, filename) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExportInvoiceHistory = async () => {
    const res = await getInvoices();
    if (!res.success || !res.data?.length) return;
    const rows = res.data.map((inv) => ({
      InvoiceNumber: inv.invoiceNumber,
      Date: inv.date,
      DueDate: inv.dueDate || '',
      CustomerName: inv.customerName || '',
      CustomerEmail: inv.customerEmail || '',
      Status: inv.status || '',
      Total: (inv.total || 0).toFixed(2),
      CreatedAt: inv.createdAt || '',
    }));
    downloadCSV(rows, `invoice-history-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportReceivables = () => {
    if (!receivables?.data?.length) return;
    const rows = receivables.data.map((inv) => ({
      InvoiceNumber: inv.invoiceNumber,
      Date: inv.date,
      DueDate: inv.dueDate || '',
      CustomerName: inv.customerName || '',
      CustomerEmail: inv.customerEmail || '',
      Status: inv.status || '',
      Total: (inv.total || 0).toFixed(2),
      DaysOverdue: inv.daysOverdue ?? '',
      Ageing: inv.ageing || '',
    }));
    downloadCSV(rows, `account-receivables-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportTravelRecords = async () => {
    const res = await getTravelRecords();
    if (!res.success || !res.data?.length) return;
    const rows = res.data.map((r) => ({
      TravelDate: r.travelDate || '',
      Origin: r.origin || '',
      Destination: r.destination || '',
      DistanceKm: (r.distanceKm ?? '').toString(),
      RoundTripKm: (r.roundTripKm ?? (r.distanceKm != null ? r.distanceKm * 2 : '')).toString(),
      TotalCost: (r.totalCost != null ? Number(r.totalCost).toFixed(2) : ''),
      Description: r.description || '',
      CreatedAt: r.createdAt || '',
    }));
    downloadCSV(rows, `distance-travelled-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleMarkAsReceived = async (invId, method) => {
    setMarkingInvoiceId(invId);
    const res = await updateInvoiceStatus(invId, { status: 'paid', paidAt: new Date().toISOString(), paymentMethod: method });
    setMarkingInvoiceId(null);
    setShowPaymentMethod(null);
    if (res.success) loadDashboardData();
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
        <div style={{ width: '64px', height: '64px', border: '4px solid #e0e0e0', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e0e0e0', padding: '20px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0' }}>Dashboard</h1>
            <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
              Welcome back, {currentUser?.fullName || currentUser?.email}
            </p>
          </div>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e3f2fd', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={24} color="#2196f3" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Total Invoices</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{stats?.totalInvoices || 0}</p>
              </div>
            </div>
          </div>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={24} color="#4caf50" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Total Revenue</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>${(stats?.totalRevenue || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', background: '#fff3e0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={24} color="#ff9800" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Account Receivables</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>${(receivables?.totalOutstanding || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={24} color="#2e7d32" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Cash collected</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>${(cashCollected?.totalCollected || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e8eaf6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={24} color="#3f51b5" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Total distance (business)</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{(totalDistanceKm || 0).toFixed(1)} km</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 24px 0' }}>Main actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <button onClick={() => navigate('/invoice')} style={{ padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
              <FileText size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Create invoice</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Prepare and send invoice</p>
            </button>
            <button onClick={() => navigate('/customers/new')} style={{ padding: '20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
              <Users size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Customer</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Add customer details</p>
            </button>
            <button onClick={() => navigate('/travel')} style={{ padding: '20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
              <MapPin size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Travel cost & distance</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Log trips and travel costs</p>
            </button>
            <button onClick={() => navigate('/setup-company')} style={{ padding: '20px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
              <Building size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Business profile</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Company information & verification</p>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Invoice history</h2>
              <button onClick={handleExportInvoiceHistory} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                <Download size={16} /> Export CSV
              </button>
            </div>
            {invoices.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px' }}>No invoices yet. Create one from Quick Actions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invoices.map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>{inv.invoiceNumber}</span>
                      <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>{inv.customerName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <span style={{ color: '#666' }}>{inv.status}</span>
                      <span style={{ fontWeight: '600' }}>${(inv.total || 0).toFixed(2)}</span>
                      {inv.status === 'paid' && !inv.workerConfirmedReceiptAt && (
                        <button onClick={() => handleConfirmReceipt(inv.id)} style={{ padding: '4px 10px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Confirm receipt</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => navigate('/invoice')} style={{ marginTop: '12px', fontSize: '14px', color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Create invoice →</button>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Account receivables (ageing)</h2>
              <button onClick={handleExportReceivables} disabled={!receivables?.data?.length} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: receivables?.data?.length ? '#ff9800' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: receivables?.data?.length ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '500' }}>
                <Download size={16} /> Export CSV
              </button>
            </div>
            {!receivables || receivables.data?.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px' }}>No outstanding receivables.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {['1-30', '30-60', '60-90', '90+'].map((bucket) => {
                    const list = receivables.byAgeing?.[bucket] || [];
                    const sum = list.reduce((s, i) => s + (i.total || 0), 0);
                    return (
                      <div key={bucket} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                        <span style={{ fontWeight: '500' }}>{bucket} days</span>
                        <span style={{ fontWeight: '600' }}>${sum.toFixed(2)} ({list.length})</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Mark as money received</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(receivables.data || []).slice(0, 10).map((inv) => (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fa', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>{inv.invoiceNumber}</span>
                          <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>{inv.customerName}</span>
                          <span style={{ marginLeft: '8px', fontWeight: '600' }}>${(inv.total || 0).toFixed(2)}</span>
                        </div>
                        {showPaymentMethod === inv.id ? (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {['cash', 'interac', 'eft_pad'].map((m) => (
                              <button
                                key={m}
                                onClick={() => handleMarkAsReceived(inv.id, m)}
                                disabled={!!markingInvoiceId}
                                style={{ padding: '6px 12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: markingInvoiceId ? 'not-allowed' : 'pointer', fontSize: '12px', textTransform: 'capitalize' }}
                              >
                                {m === 'eft_pad' ? 'EFT/PAD' : m}
                              </button>
                            ))}
                            <button onClick={() => setShowPaymentMethod(null)} style={{ padding: '6px 12px', background: '#999', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowPaymentMethod(inv.id)} style={{ padding: '6px 12px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Mark received</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Distance travelled (business)</h2>
            <button onClick={handleExportTravelRecords} disabled={travelRecords.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: travelRecords.length ? '#3f51b5' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: travelRecords.length ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '500' }}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          {travelRecords.length === 0 ? (
            <p style={{ color: '#666', fontSize: '14px' }}>No travel records yet. Use Travel to calculate a trip and add to invoice — each trip is recorded here.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {travelRecords.map((rec) => (
                <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                  <div>
                    <span style={{ fontWeight: '600' }}>{(rec.roundTripKm ?? (rec.distanceKm * 2) ?? 0).toFixed(1)} km</span>
                    <span style={{ marginLeft: '8px', color: '#666' }}>{rec.travelDate}</span>
                    {(rec.origin || rec.destination) && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{rec.origin} → {rec.destination}</div>
                    )}
                  </div>
                  {rec.totalCost != null && <span style={{ fontWeight: '500' }}>${Number(rec.totalCost).toFixed(2)}</span>}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/travel')} style={{ marginTop: '12px', fontSize: '14px', color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Go to Travel →</button>
        </div>

        {companyInfo && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginTop: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 24px 0' }}>Your profile</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Business name</p>
                <p style={{ fontWeight: '600', margin: 0 }}>{companyInfo.legalBusinessName || companyInfo.companyName}</p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Email</p>
                <p style={{ fontWeight: '600', margin: 0 }}>{companyInfo.email}</p>
              </div>
              {companyInfo.gstNumber && (
                <div>
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>HST/GST</p>
                  <p style={{ fontWeight: '600', margin: 0 }}>{companyInfo.gstNumber}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default Dashboard;
