import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  LogOut,
  DollarSign,
  MessageSquare,
  Users,
  Calendar,
  CreditCard,
  Receipt,
  Plus,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';
import { getInvoicesForCustomer } from '../../services/invoiceService';
import { getMyNotifications } from '../../services/notificationService';
import {
  getServiceProviders,
  addServiceProvider,
  deleteServiceProvider,
  SERVICE_TYPES,
} from '../../services/serviceProviderService';
import {
  getServiceAppointments,
  addServiceAppointment,
  updateServiceAppointment,
  deleteServiceAppointment,
} from '../../services/serviceAppointmentService';
import { sendEmail } from '../../services/emailService';

/** Customer / Payor dashboard only. Workers are redirected to worker dashboard. */
function CustomerDashboard() {
  const navigate = useNavigate();
  const { userRole, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('providers');
  const [invoices, setInvoices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddAppointment, setShowAddAppointment] = useState(false);

  if (userRole && userRole !== 'customer') return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    const [invRes, notifRes, provRes, apptRes] = await Promise.all([
      getInvoicesForCustomer(),
      getMyNotifications(20),
      getServiceProviders(),
      getServiceAppointments(),
    ]);
    if (invRes.success) setInvoices(invRes.data || []);
    if (notifRes.success) setNotifications(notifRes.data || []);
    if (provRes.success) setProviders(provRes.data || []);
    if (apptRes.success) setAppointments(apptRes.data || []);
    setLoading(false);
  };

  const unpaidStatuses = ['sent', 'viewed', 'accepted', 'contested'];
  const payableInvoices = invoices.filter((i) => unpaidStatuses.includes(i.status));
  const medicalBills = invoices.filter((i) => i.status === 'paid');
  const totalPayable = payableInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalMedicalExpense = medicalBills.reduce((s, i) => s + (i.total || 0), 0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dueTomorrow = payableInvoices.filter(
    (inv) => inv.dueDate === tomorrowStr
  );

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const handleAddProvider = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      serviceType: form.serviceType.value,
      serviceTypeOther: form.serviceTypeOther?.value || '',
      providerName: form.providerName.value,
      providerEmail: form.providerEmail.value,
      providerPhone: form.providerPhone.value,
      companyName: form.companyName.value,
      notes: form.notes.value,
    };
    const res = await addServiceProvider(data);
    if (res.success) {
      setShowAddProvider(false);
      load();
    } else setError(res.error);
  };

  const handleAddAppointment = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      providerId: form.providerId.value || null,
      providerName: form.providerName.value || '',
      appointmentDate: form.appointmentDate.value || null,
      checkIn: form.checkIn?.value || null,
      checkOut: form.checkOut?.value || null,
      serviceType: form.serviceType.value || '',
      notes: form.notes.value || '',
      invoiceId: form.invoiceId?.value || null,
      manualInvoiceAmount: form.manualInvoiceAmount?.value ? parseFloat(form.manualInvoiceAmount.value) : null,
      manualInvoiceRef: form.manualInvoiceRef?.value || '',
      manualInvoiceDate: form.manualInvoiceDate?.value || null,
      isManual: true,
    };
    const res = await addServiceAppointment(data);
    if (res.success) {
      setShowAddAppointment(false);
      load();
      // Send confirmation emails to customer and provider
      const base = window.location.origin;
      const subject = 'Appointment added';
      const apptDate = data.appointmentDate ? new Date(data.appointmentDate).toLocaleDateString() : 'TBD';
      const customerText = `Your service appointment has been added.\n\nDate: ${apptDate}\nProvider: ${data.providerName || 'N/A'}\nService: ${data.serviceType || 'N/A'}\n\nView your appointments: ${base}`;
      if (currentUser?.email) {
        sendEmail({ to: currentUser.email, subject, text: customerText }).catch((e) => console.warn('Appointment confirmation email failed:', e));
      }
      const provider = providers.find((p) => p.id === data.providerId);
      if (provider?.providerEmail) {
        const providerText = `A new appointment has been scheduled.\n\nDate: ${apptDate}\nCustomer: ${currentUser?.email || 'Customer'}\nService: ${data.serviceType || 'N/A'}\n\nView your dashboard: ${base}`;
        sendEmail({ to: provider.providerEmail, subject: 'New appointment scheduled', text: providerText }).catch((e) => console.warn('Provider notification email failed:', e));
      }
    } else setError(res.error);
  };

  const handleLinkInvoice = async (appointmentId, invoiceId) => {
    const res = await updateServiceAppointment(appointmentId, { invoiceId: invoiceId || null });
    if (res.success) load();
    else setError(res.error);
  };

  const handleDeleteProvider = async (id) => {
    if (!window.confirm('Remove this service provider?')) return;
    const res = await deleteServiceProvider(id);
    if (res.success) load();
    else setError(res.error);
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm('Delete this appointment?')) return;
    const res = await deleteServiceAppointment(id);
    if (res.success) load();
    else setError(res.error);
  };

  const getProviderLabel = (p) =>
    p.serviceType === 'Other' && p.serviceTypeOther ? p.serviceTypeOther : p.serviceType;

  const getInvoiceById = (id) => invoices.find((i) => i.id === id);

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    border: 'none',
    background: activeTab === tab ? '#0d9488' : 'transparent',
    color: activeTab === tab ? 'white' : '#334155',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const cardStyle = { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
  const inputStyle = { width: '100%', padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: '#334155' };

  if (loading && invoices.length === 0 && providers.length === 0 && appointments.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0fdfa' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e0e0e0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdfa' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Customer dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/customer-profile-setup')} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>
            Profile
          </button>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}>
        {/* Tab navigation */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <button style={tabStyle('providers')} onClick={() => setActiveTab('providers')}>
            <Users size={18} /> Service providers
          </button>
          <button style={tabStyle('appointments')} onClick={() => setActiveTab('appointments')}>
            <Calendar size={18} /> Service appointments
          </button>
          <button style={tabStyle('payable')} onClick={() => setActiveTab('payable')}>
            <CreditCard size={18} /> Payable to provider
          </button>
          <button style={tabStyle('medical')} onClick={() => setActiveTab('medical')}>
            <Receipt size={18} /> Medical bills
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {dueTomorrow.length > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
            <strong>Reminder:</strong> {dueTomorrow.length} invoice{dueTomorrow.length > 1 ? 's' : ''} due tomorrow ({tomorrowStr}).{' '}
            {dueTomorrow.map((inv) => (
              <button key={inv.id} onClick={() => navigate(`/customer/invoice/${inv.id}`)} style={{ marginLeft: '8px', padding: '4px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                View {inv.invoiceNumber}
              </button>
            ))}
          </div>
        )}

        {/* Service providers tab */}
        {activeTab === 'providers' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Service providers</h2>
              <button onClick={() => setShowAddProvider(!showAddProvider)} style={{ padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Plus size={18} /> Add provider
              </button>
            </div>
            {showAddProvider && (
              <form onSubmit={handleAddProvider} style={{ marginBottom: '24px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add service provider</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Service type *</label>
                    <select name="serviceType" required style={inputStyle}>
                      {SERVICE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div id="other-type-wrap">
                    <label style={labelStyle}>Other (if applicable)</label>
                    <input type="text" name="serviceTypeOther" placeholder="Specify type" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Provider name</label>
                    <input type="text" name="providerName" placeholder="e.g. Jane Smith" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Company / agency</label>
                    <input type="text" name="companyName" placeholder="e.g. ABC Care Services" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" name="providerEmail" placeholder="provider@example.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input type="tel" name="providerPhone" placeholder="+1 555 123 4567" style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea name="notes" rows={2} placeholder="Additional notes" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" style={{ padding: '10px 20px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    Save provider
                  </button>
                  <button type="button" onClick={() => setShowAddProvider(false)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {providers.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No service providers yet. Add providers (PSW, RPN, RN, etc.) to track your care team.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {providers.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{p.providerName || 'Unnamed'}</div>
                      <div style={{ fontSize: '14px', color: '#64748b' }}>
                        {getProviderLabel(p)} {p.companyName && `• ${p.companyName}`}
                      </div>
                      {p.providerEmail && <div style={{ fontSize: '13px', color: '#64748b' }}>{p.providerEmail}</div>}
                    </div>
                    <button onClick={() => handleDeleteProvider(p.id)} style={{ padding: '6px 12px', background: '#fee', color: '#c33', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Service appointments tab */}
        {activeTab === 'appointments' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Service appointments</h2>
              <button onClick={() => setShowAddAppointment(!showAddAppointment)} style={{ padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Plus size={18} /> Add manually
              </button>
            </div>
            {showAddAppointment && (
              <form onSubmit={handleAddAppointment} style={{ marginBottom: '24px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add service appointment manually</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Provider</label>
                    <select name="providerId" style={inputStyle}>
                      <option value="">— Select or enter below —</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.providerName || getProviderLabel(p)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Provider name (if not in list)</label>
                    <input type="text" name="providerName" placeholder="e.g. Jane Smith" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Appointment date</label>
                    <input type="date" name="appointmentDate" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Check-in (time)</label>
                    <input type="time" name="checkIn" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Check-out (time)</label>
                    <input type="time" name="checkOut" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Service type</label>
                    <input type="text" name="serviceType" placeholder="e.g. Personal care" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Link to invoice (optional)</label>
                    <select name="invoiceId" style={inputStyle}>
                      <option value="">— No invoice —</option>
                      {invoices.map((i) => (
                        <option key={i.id} value={i.id}>{i.invoiceNumber} - ${(i.total || 0).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '16px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Manual invoice (if not from platform)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Amount</label>
                      <input type="number" name="manualInvoiceAmount" step="0.01" placeholder="0.00" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Ref / invoice #</label>
                      <input type="text" name="manualInvoiceRef" placeholder="Reference" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Date</label>
                      <input type="date" name="manualInvoiceDate" style={inputStyle} />
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea name="notes" rows={2} placeholder="Additional notes" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" style={{ padding: '10px 20px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    Save appointment
                  </button>
                  <button type="button" onClick={() => setShowAddAppointment(false)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {appointments.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No appointments yet. Add appointments manually or they will appear here when linked from the platform.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {appointments.map((a) => {
                  const inv = a.invoiceId ? getInvoiceById(a.invoiceId) : null;
                  return (
                    <div key={a.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.providerName || 'Provider'}</div>
                          <div style={{ fontSize: '14px', color: '#64748b' }}>
                            {a.appointmentDate && new Date(a.appointmentDate).toLocaleDateString()}
                            {a.checkIn && ` • ${a.checkIn}`}
                            {a.checkOut && ` – ${a.checkOut}`}
                            {a.serviceType && ` • ${a.serviceType}`}
                          </div>
                          {a.notes && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{a.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {inv ? (
                            <button onClick={() => navigate(`/customer/invoice/${inv.id}`)} style={{ padding: '6px 12px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                              View invoice {inv.invoiceNumber}
                            </button>
                          ) : invoices.length > 0 ? (
                            <select
                              value=""
                              onChange={(e) => {
                                const v = e.target.value;
                                handleLinkInvoice(a.id, v || null);
                              }}
                              style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '13px' }}
                            >
                              <option value="">Link invoice</option>
                              {invoices.map((i) => (
                                <option key={i.id} value={i.id}>{i.invoiceNumber} - ${(i.total || 0).toFixed(2)}</option>
                              ))}
                            </select>
                          ) : null}
                          {(a.manualInvoiceAmount || a.manualInvoiceRef) && (
                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                              ${(a.manualInvoiceAmount || 0).toFixed(2)} {a.manualInvoiceRef && `(${a.manualInvoiceRef})`}
                            </span>
                          )}
                          <button onClick={() => handleDeleteAppointment(a.id)} style={{ padding: '6px 12px', background: '#fee', color: '#c33', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Payable to service provider tab */}
        {activeTab === 'payable' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>Payable to service provider</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>Unpaid invoices raised by your service providers. Once paid, they are recorded under Medical bills.</p>
            <div style={{ marginBottom: '20px', padding: '16px', background: '#fef3c7', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <DollarSign size={24} color="#b45309" />
              <div>
                <div style={{ fontSize: '13px', color: '#92400e' }}>Total outstanding</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#92400e' }}>${totalPayable.toFixed(2)}</div>
              </div>
            </div>
            {payableInvoices.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No unpaid invoices. When a provider sends you an invoice, it will appear here until paid.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {payableInvoices.map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{inv.invoiceNumber}</div>
                      <div style={{ fontSize: '14px', color: '#64748b' }}>{inv.companyName || inv.legalBusinessName} • Due: {inv.dueDate || '–'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 600, fontSize: '16px' }}>${(inv.total || 0).toFixed(2)}</span>
                      <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '6px', background: '#fef3c7', color: '#92400e' }}>{inv.status}</span>
                      <button onClick={() => navigate(`/customer/invoice/${inv.id}`)} style={{ padding: '8px 14px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>
                        View / Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Medical bills tab */}
        {activeTab === 'medical' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>Medical bills</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>Record of paid invoices for services received.</p>
            <div style={{ marginBottom: '20px', padding: '16px', background: '#dcfce7', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Receipt size={24} color="#15803d" />
              <div>
                <div style={{ fontSize: '13px', color: '#15803d' }}>Total medical expense (paid)</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#15803d' }}>${totalMedicalExpense.toFixed(2)}</div>
              </div>
            </div>
            {medicalBills.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No paid invoices yet. Paid invoices will appear here for your records.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {medicalBills.map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{inv.invoiceNumber}</div>
                      <div style={{ fontSize: '14px', color: '#64748b' }}>
                        {inv.companyName || inv.legalBusinessName} • Paid: {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '–'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 600, fontSize: '16px' }}>${(inv.total || 0).toFixed(2)}</span>
                      <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={14} /> Paid
                      </span>
                      <button onClick={() => navigate(`/customer/invoice/${inv.id}`)} style={{ padding: '8px 14px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {notifications.length > 0 && (
          <div style={{ ...cardStyle, marginTop: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={20} /> Notifications
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}>
                  <strong>{n.title}</strong> {n.body && <span style={{ color: '#64748b' }}> – {n.body}</span>}
                  {n.link && <a href={n.link} style={{ marginLeft: '8px', color: '#0d9488', fontSize: '13px' }}>View</a>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default CustomerDashboard;
