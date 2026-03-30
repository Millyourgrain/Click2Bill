import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogOut, Building, FileText, TrendingUp, DollarSign, MapPin, Download, LayoutGrid, Users, Mail, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';
import { getCompanyInfo } from '../../services/companyService';
import {
  getInvoiceStats,
  getInvoices,
  getAccountReceivables,
  getCashCollected,
  updateInvoiceStatus,
  submitInvoiceForApproval,
  approveInvoiceAsChecker,
  issueInvoiceToCustomer,
  getInvoiceDeletionsForOrg,
  updateInvoice,
  generateInvoicePortalToken,
} from '../../services/invoiceService';
import { getTravelRecords } from '../../services/travelRecordService';
import DashboardCustomersTab from './DashboardCustomersTab';
import { formatInvoiceMoney, DEFAULT_INVOICE_CURRENCY, formatTotalsByCurrencyLines, totalsByCurrency, INVOICE_CURRENCY_OPTIONS } from '../../utils/invoiceCurrency';
import { sendEmail } from '../../services/emailService';

/** Worker / Agency dashboard only. Customers are redirected to customer dashboard. */
function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, userRole, workerDashboardPersona } = useAuth();
  const persona = workerDashboardPersona || 'org_admin';

  const [companyInfo, setCompanyInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [receivables, setReceivables] = useState(null);
  const [cashCollected, setCashCollected] = useState(null);
  const [travelRegisterRecords, setTravelRegisterRecords] = useState([]);
  const [scrapRecords, setScrapRecords] = useState([]);
  const [allInvoicesKpi, setAllInvoicesKpi] = useState([]);
  const [overviewCurrency, setOverviewCurrency] = useState('all');
  const [loading, setLoading] = useState(true);
  const [markingInvoiceId, setMarkingInvoiceId] = useState(null);
  const [showPaymentMethod, setShowPaymentMethod] = useState(null);
  const [invoiceWorkflowId, setInvoiceWorkflowId] = useState(null);
  const [dashboardTab, setDashboardTab] = useState('overview');
  const [arWorkspaceTab, setArWorkspaceTab] = useState('receive');
  const [remindingInvoiceId, setRemindingInvoiceId] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, [persona]);

  const handleConfirmReceipt = async (invId) => {
    await updateInvoiceStatus(invId, { workerConfirmedReceiptAt: new Date().toISOString() });
    loadDashboardData();
  };

  const loadDashboardData = async () => {
    try {
      const [companyResult, statsResult, invResult, arResult, cashResult, travelResult, scrapResult] = await Promise.all([
        getCompanyInfo(),
        getInvoiceStats(),
        getInvoices(),
        getAccountReceivables(),
        getCashCollected(),
        getTravelRecords(),
        getInvoiceDeletionsForOrg(),
      ]);
      if (companyResult.success) setCompanyInfo(companyResult.data);
      if (statsResult.success) setStats(statsResult.data);
      if (invResult.success) {
        const full = invResult.data || [];
        const byIdFull = new Map();
        for (const inv of full) {
          if (inv?.id) byIdFull.set(inv.id, inv);
        }
        const dedupedFull = [...byIdFull.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setAllInvoicesKpi(dedupedFull);

        let slice = dedupedFull.slice(0, 60);
        const byId = new Map();
        for (const inv of slice) {
          if (inv?.id) byId.set(inv.id, inv);
        }
        slice = [...byId.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 20);
        const mc =
          companyResult.success && companyResult.data?.invoiceSystem === 'maker_checker';
        if (mc && persona === 'org_admin') {
          slice = slice.filter(
            (inv) =>
              inv.status !== 'draft' ||
              inv.approvalState === 'pending_checker' ||
              inv.approvalState === 'approved'
          );
        }
        setInvoices(slice);
      }
      if (arResult.success) setReceivables(arResult);
      if (cashResult.success) setCashCollected(cashResult);
      if (travelResult.success) {
        setTravelRegisterRecords(travelResult.data || []);
      }
      if (scrapResult.success) {
        setScrapRecords(scrapResult.data || []);
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

  const handleExportTravelRecords = () => {
    if (!travelRegisterRecords.length) return;
    const rows = travelRegisterRecords.map((r) => ({
      TravelDate: r.travelDate || '',
      Origin: r.origin || '',
      Destination: r.destination || '',
      DistanceKm: (r.distanceKm ?? '').toString(),
      RoundTripKm: (r.roundTripKm ?? (r.distanceKm != null ? r.distanceKm * 2 : '')).toString(),
      TotalCost: (r.totalCost != null ? Number(r.totalCost).toFixed(2) : ''),
      Description: r.description || '',
      CreatedAt: r.createdAt || '',
    }));
    downloadCSV(rows, `travel-register-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const sendReceivableReminder = async (inv) => {
    const to = (inv.payorEmail || inv.customerEmail || '').trim();
    if (!to) {
      alert('No customer or payor email on this invoice.');
      return;
    }
    setRemindingInvoiceId(inv.id);
    let token = inv.portalToken || null;
    if (!token) {
      token = generateInvoicePortalToken();
      await updateInvoice(inv.id, { portalToken: token });
    }
    const link = `${window.location.origin}/invoice/view/${inv.id}?t=${encodeURIComponent(token)}`;
    const subj = `Reminder: invoice ${inv.invoiceNumber} outstanding`;
    const cur = inv.currency || DEFAULT_INVOICE_CURRENCY;
    const amt = formatInvoiceMoney(inv.total || 0, cur);
    const text =
      `Dear ${inv.customerName || 'customer'},\n\n`
      + `This is a friendly reminder that invoice ${inv.invoiceNumber} (${amt}) remains outstanding.\n`
      + `Due date: ${inv.dueDate || 'as stated on the invoice'}.\n\n`
      + `View and pay: ${link}\n\n`
      + `${companyInfo?.legalBusinessName || companyInfo?.companyName || 'Your supplier'}`;
    const html = `<p>Dear ${inv.customerName || 'customer'},</p>`
      + `<p>This is a friendly reminder that invoice <strong>${inv.invoiceNumber}</strong> (<strong>${amt}</strong>) remains outstanding.</p>`
      + `<p>Due: ${inv.dueDate || 'as stated on the invoice'}.</p>`
      + `<p><a href="${link}">Open invoice</a></p>`
      + `<p>${companyInfo?.legalBusinessName || companyInfo?.companyName || ''}</p>`;
    const res = await sendEmail({ to, subject: subj, text, html });
    setRemindingInvoiceId(null);
    if (res.success) alert('Reminder sent.');
    else alert(res.error || 'Could not send reminder.');
  };

  const handleMarkAsReceived = async (invId, method) => {
    setMarkingInvoiceId(invId);
    const res = await updateInvoiceStatus(invId, { status: 'paid', paidAt: new Date().toISOString(), paymentMethod: method });
    setMarkingInvoiceId(null);
    setShowPaymentMethod(null);
    if (res.success) loadDashboardData();
  };

  const runInvoiceWorkflow = async (invoiceId, fn) => {
    setInvoiceWorkflowId(invoiceId);
    const res = await fn(invoiceId);
    setInvoiceWorkflowId(null);
    if (res?.success) loadDashboardData();
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const revenueByCurrency = useMemo(() => totalsByCurrency(allInvoicesKpi), [allInvoicesKpi]);
  const overviewCurrencies = useMemo(() => {
    const ar = receivables?.totalsOutstandingByCurrency || {};
    const cash = cashCollected?.collectedByCurrency || {};
    const s = new Set([
      ...Object.keys(revenueByCurrency),
      ...Object.keys(ar),
      ...Object.keys(cash),
    ]);
    const list = [...s].filter(Boolean);
    list.sort((a, b) => {
      if (a === DEFAULT_INVOICE_CURRENCY) return -1;
      if (b === DEFAULT_INVOICE_CURRENCY) return 1;
      return a.localeCompare(b);
    });
    if (!list.length) list.push(DEFAULT_INVOICE_CURRENCY);
    return list;
  }, [revenueByCurrency, receivables, cashCollected]);

  const currenciesToShow = overviewCurrency === 'all' ? overviewCurrencies : [overviewCurrency];

  const travelTotalKm = useMemo(() => {
    return (travelRegisterRecords || []).reduce((sum, r) => {
      const km = r.roundTripKm != null ? Number(r.roundTripKm) : (r.distanceKm != null ? Number(r.distanceKm) : 0);
      return sum + km;
    }, 0);
  }, [travelRegisterRecords]);

  if (userRole === 'customer') return <Navigate to="/customer-dashboard" replace />;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
        <div style={{ width: '64px', height: '64px', border: '4px solid var(--cream-mid)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const isMc = companyInfo?.invoiceSystem === 'maker_checker';
  const canMaker = persona === 'maker' || persona === 'org_admin';
  const canChecker = persona === 'checker' || persona === 'org_admin';
  const dashboardHeading =
    persona === 'maker'
      ? 'Maker dashboard'
      : persona === 'checker'
        ? 'Checker dashboard'
        : isMc
          ? 'Admin dashboard'
          : 'Authorized signatory dashboard';
  const dashboardSub =
    persona === 'maker'
      ? 'Create, edit, and view all organization invoices.'
      : persona === 'checker'
        ? 'Approve, send to customers, and view all organization invoices.'
        : isMc
          ? 'Organization-wide view: drafts in workflow, approved items, and invoices sent to customers.'
          : 'Full access to invoicing, travel register, and business profile.';

  const arOutstandingMap = receivables?.totalsOutstandingByCurrency || {};
  const cashMap = cashCollected?.collectedByCurrency || {};

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ background: 'var(--navy)', borderBottom: '2px solid var(--gold)', padding: '20px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--cream)' }}>{dashboardHeading}</h1>
            <p style={{ color: 'rgba(250,246,239,0.85)', fontSize: '14px', margin: '4px 0 0 0' }}>
              {dashboardSub} Welcome back, {currentUser?.fullName || currentUser?.email}.
            </p>
          </div>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--cream-dark)', borderBottom: '1px solid var(--cream-mid)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setDashboardTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 18px',
              border: 'none',
              borderBottom: dashboardTab === 'overview' ? '3px solid var(--gold)' : '3px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: dashboardTab === 'overview' ? '700' : '500',
              color: dashboardTab === 'overview' ? 'var(--navy)' : 'var(--text-muted)',
              fontSize: '14px',
              marginBottom: '-1px',
            }}
          >
            <LayoutGrid size={18} /> Overview
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('customers')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 18px',
              border: 'none',
              borderBottom: dashboardTab === 'customers' ? '3px solid var(--gold)' : '3px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: dashboardTab === 'customers' ? '700' : '500',
              color: dashboardTab === 'customers' ? 'var(--navy)' : 'var(--text-muted)',
              fontSize: '14px',
              marginBottom: '-1px',
            }}
          >
            <Users size={18} /> Customers
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('travel')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 18px',
              border: 'none',
              borderBottom: dashboardTab === 'travel' ? '3px solid var(--gold)' : '3px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: dashboardTab === 'travel' ? '700' : '500',
              color: dashboardTab === 'travel' ? 'var(--navy)' : 'var(--text-muted)',
              fontSize: '14px',
              marginBottom: '-1px',
            }}
          >
            <MapPin size={18} /> Travel register
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('scrap')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 18px',
              border: 'none',
              borderBottom: dashboardTab === 'scrap' ? '3px solid var(--gold)' : '3px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: dashboardTab === 'scrap' ? '700' : '500',
              color: dashboardTab === 'scrap' ? 'var(--navy)' : 'var(--text-muted)',
              fontSize: '14px',
              marginBottom: '-1px',
            }}
          >
            <Trash2 size={18} /> Scrap
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 40px' }}>
        {dashboardTab === 'customers' && (
          <div style={{ marginBottom: '32px' }}>
            <DashboardCustomersTab />
          </div>
        )}

        {dashboardTab === 'scrap' && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px', minHeight: '360px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>Scrap</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0', maxWidth: '720px', lineHeight: 1.5 }}>
              Deleted invoice drafts and records removed from active billing are listed here for your audit trail. These rows are not invoices anymore — they are destruction log entries only.
            </p>
            {scrapRecords.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px' }}>No deleted invoices logged yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {scrapRecords.map((row) => (
                  <div
                    key={row.id}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.5fr)', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eee', fontSize: '13px', alignItems: 'start' }}
                  >
                    <div>
                      <div style={{ fontWeight: '600' }}>{row.invoiceNumber || row.invoiceId || '—'}</div>
                      <div style={{ color: '#64748b', marginTop: '4px' }}>{row.deletedAt ? new Date(row.deletedAt).toLocaleString() : '—'}</div>
                    </div>
                    <div>
                      <div>{row.invoiceStatus || '—'}</div>
                      {row.invoiceTotal != null && (
                        <div style={{ fontWeight: '600', marginTop: '4px' }}>{formatInvoiceMoney(Number(row.invoiceTotal), row.currency || DEFAULT_INVOICE_CURRENCY)}</div>
                      )}
                    </div>
                    <div style={{ color: '#475569', lineHeight: 1.45 }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>{row.deletedByEmail || 'Unknown user'}</div>
                      {row.deletionCommentary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {dashboardTab === 'travel' && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px', minHeight: '360px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Travel register</h2>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total distance travelled</p>
                <p style={{ fontSize: '26px', fontWeight: '700', margin: '6px 0 0', color: 'var(--navy)' }}>{travelTotalKm.toFixed(1)} km</p>
              </div>
            </div>
            {travelRegisterRecords.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px', flex: 1 }}>No travel records yet. Record mileage from an invoice or open the travel cost estimator.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {travelRegisterRecords.map((rec) => (
                  <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>{(rec.roundTripKm != null ? Number(rec.roundTripKm) : (rec.distanceKm != null ? Number(rec.distanceKm) : 0)).toFixed(1)} km</span>
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
            <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate('/travel')} style={{ fontSize: '14px', color: 'var(--gold-dark)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                Open travel cost estimator →
              </button>
              <button type="button" onClick={handleExportTravelRecords} disabled={!travelRegisterRecords.length} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: travelRegisterRecords.length ? '#3f51b5' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', cursor: travelRegisterRecords.length ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '500' }}>
                <Download size={16} /> Download CSV
              </button>
            </div>
          </div>
        )}

        {dashboardTab === 'overview' && (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e3f2fd', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={24} color="#2196f3" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Total invoices</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{stats?.totalInvoices || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Currency</label>
          <select
            value={overviewCurrency}
            onChange={(e) => setOverviewCurrency(e.target.value)}
            style={{ maxWidth: '360px', width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#fafafa' }}
          >
            <option value="all">All currencies (separate totals per currency)</option>
            {INVOICE_CURRENCY_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </select>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '10px 0 0 0', lineHeight: 1.45 }}>
            Revenue is the sum of all invoice totals in each currency (same basis as the former overview total). Account receivable and cash collected use amounts in the invoice&apos;s currency.
          </p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          {currenciesToShow.map((code) => {
            const revenue = revenueByCurrency[code] || 0;
            const arAmt = arOutstandingMap[code] || 0;
            const cashAmt = cashMap[code] || 0;
            const showArCash = persona !== 'checker';
            return (
              <div key={code} style={{ marginBottom: overviewCurrency === 'all' ? '28px' : '0' }}>
                {overviewCurrency === 'all' && (
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 14px 0', color: 'var(--navy)' }}>{code}</h3>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
                  <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={24} color="#4caf50" />
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Revenue ({code})</p>
                        <p style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{formatInvoiceMoney(revenue, code)}</p>
                      </div>
                    </div>
                  </div>
                  {showArCash && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '48px', height: '48px', background: '#fff3e0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={24} color="#ff9800" />
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Account receivable ({code})</p>
                          <p style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{formatInvoiceMoney(arAmt, code)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {showArCash && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={24} color="#2e7d32" />
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Cash collected ({code})</p>
                          <p style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{formatInvoiceMoney(cashAmt, code)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 24px 0' }}>Main actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <button onClick={() => navigate('/invoice')} style={{ padding: '20px', background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-700) 100%)', color: 'white', border: '2px solid var(--gold)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
              <FileText size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Invoice</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Create, edit, approve, or send — depending on your role.</p>
            </button>
            <button onClick={() => navigate('/travel')} style={{ padding: '20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
              <MapPin size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Travel register</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Business trips and costs for sales calls, service visits, and billing.</p>
            </button>
            <button onClick={() => navigate('/setup-company')} style={{ padding: '20px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
              <Building size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Business profile</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Company information and verification; Admins manage teammates from setup.</p>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: persona === 'checker' ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Invoice history</h2>
              <button onClick={handleExportInvoiceHistory} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                <Download size={16} /> Export CSV
              </button>
            </div>
            {invoices.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px' }}>No invoices in this list yet. Open Invoice to create or work on one.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invoices.map((inv) => {
                  const showSubmit =
                    isMc &&
                    canMaker &&
                    inv.status === 'draft' &&
                    inv.approvalState !== 'pending_checker' &&
                    inv.approvalState !== 'approved';
                  const showApprove = isMc && canChecker && inv.approvalState === 'pending_checker';
                  const showIssue =
                    isMc &&
                    canChecker &&
                    inv.status === 'draft' &&
                    inv.approvalState !== 'pending_checker' &&
                    inv.approvalState !== 'draft';
                  const busy = invoiceWorkflowId === inv.id;
                  return (
                    <div
                      key={inv.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/invoices/${inv.id}`); } }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px', cursor: 'pointer' }}
                    >
                      <div>
                        <span style={{ fontWeight: '600' }}>{inv.invoiceNumber}</span>
                        <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>{inv.customerName}</span>
                        {inv.approvalState && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#555', textTransform: 'capitalize' }}>({String(inv.approvalState).replace(/_/g, ' ')})</span>
                        )}
                      </div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', flexWrap: 'wrap' }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <span style={{ color: '#666' }}>{inv.status}</span>
                        <span style={{ fontWeight: '600' }}>{formatInvoiceMoney(inv.total || 0, inv.currency || DEFAULT_INVOICE_CURRENCY)}</span>
                        {showSubmit && (
                          <button type="button" disabled={busy} onClick={() => runInvoiceWorkflow(inv.id, submitInvoiceForApproval)} style={{ padding: '4px 10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '12px', fontWeight: '500' }}>Submit for approval</button>
                        )}
                        {showApprove && (
                          <button type="button" disabled={busy} onClick={() => runInvoiceWorkflow(inv.id, approveInvoiceAsChecker)} style={{ padding: '4px 10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '12px', fontWeight: '500' }}>Approve</button>
                        )}
                        {showIssue && (
                          <button type="button" disabled={busy} onClick={() => runInvoiceWorkflow(inv.id, issueInvoiceToCustomer)} style={{ padding: '4px 10px', background: '#ca8a04', color: 'white', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '12px', fontWeight: '500' }}>Send to customer</button>
                        )}
                        {persona !== 'checker' && inv.status === 'paid' && !inv.workerConfirmedReceiptAt && (
                          <button type="button" onClick={() => handleConfirmReceipt(inv.id)} style={{ padding: '4px 10px', background: 'var(--navy)', color: 'var(--cream)', border: '1px solid var(--gold)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Confirm receipt</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => navigate('/invoice')} style={{ marginTop: '12px', fontSize: '14px', color: 'var(--gold-dark)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Open invoice →</button>
          </div>

          {persona !== 'checker' && (
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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setArWorkspaceTab('receive')} style={{ padding: '10px 14px', border: 'none', borderBottom: arWorkspaceTab === 'receive' ? '3px solid var(--gold)' : '3px solid transparent', background: arWorkspaceTab === 'receive' ? '#f5f3ff' : 'transparent', cursor: 'pointer', fontWeight: arWorkspaceTab === 'receive' ? '700' : '500', fontSize: '14px', marginBottom: '-1px' }}>
                    Mark received
                  </button>
                  <button type="button" onClick={() => setArWorkspaceTab('remind')} style={{ padding: '10px 14px', border: 'none', borderBottom: arWorkspaceTab === 'remind' ? '3px solid var(--gold)' : '3px solid transparent', background: arWorkspaceTab === 'remind' ? '#f5f3ff' : 'transparent', cursor: 'pointer', fontWeight: arWorkspaceTab === 'remind' ? '700' : '500', fontSize: '14px', marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={16} /> Send reminder
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {['0-30', '30-60', '60-90', '90+'].map((bucket) => {
                    const list = receivables.byAgeing?.[bucket] || [];
                    const byCur = totalsByCurrency(list);
                    const line = formatTotalsByCurrencyLines(byCur);
                    return (
                      <div key={bucket} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontWeight: '500' }}>{bucket === '0-30' ? '0–30 days' : `${bucket} days`}</span>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{line || '—'} <span style={{ color: '#666', fontWeight: '500' }}>({list.length})</span></span>
                      </div>
                    );
                  })}
                </div>
                {arWorkspaceTab === 'receive' && (
                <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Mark as money received</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(receivables.data || []).slice(0, 10).map((inv) => (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fa', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>{inv.invoiceNumber}</span>
                          <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>{inv.customerName}</span>
                          <span style={{ marginLeft: '8px', fontWeight: '600' }}>{formatInvoiceMoney(inv.total || 0, inv.currency || DEFAULT_INVOICE_CURRENCY)}</span>
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
                )}
                {arWorkspaceTab === 'remind' && (
                <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Payment reminders</p>
                  <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>Send a short email to the customer or payor with a link to the invoice.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(receivables.data || []).map((inv) => (
                      <div key={`rem-${inv.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f0f9ff', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>{inv.invoiceNumber}</span>
                          <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>{inv.customerName}</span>
                          <span style={{ marginLeft: '8px', fontWeight: '600' }}>{formatInvoiceMoney(inv.total || 0, inv.currency || DEFAULT_INVOICE_CURRENCY)}</span>
                        </div>
                        <button type="button" disabled={!!remindingInvoiceId} onClick={() => sendReceivableReminder(inv)} style={{ padding: '6px 12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: remindingInvoiceId ? 'wait' : 'pointer', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={14} /> {remindingInvoiceId === inv.id ? 'Sending…' : 'Send reminder'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </>
            )}
          </div>
          )}
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
        </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default Dashboard;
