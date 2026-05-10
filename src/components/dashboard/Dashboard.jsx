import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogOut, Building, FileText, TrendingUp, DollarSign, MapPin, Download, LayoutGrid, Users, Mail, Trash2, FileCheck, ChevronDown } from 'lucide-react';
import { buildAccountingCsv, downloadCsvFile } from '../../utils/accountingExport';
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
  const { currentUser, userRole, workerDashboardPersona, canCreateInvoice, canApproveInvoice } = useAuth();
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
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportWarnings, setExportWarnings] = useState([]);
  const exportDropdownRef = useRef(null);

  useEffect(() => {
    loadDashboardData();
  }, [persona]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
              inv.approvalState === 'approved' ||
              inv.approvalState === 'returned_to_maker'
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

  /**
   * Export invoice history in the requested accounting format.
   * @param {'platform'|'xero'|'qbo'} format
   */
  const handleExportInvoiceHistory = async (format = 'platform') => {
    setExportDropdownOpen(false);
    const res = await getInvoices();
    if (!res.success || !res.data?.length) return;
    const { csv, filename, warnings } = buildAccountingCsv(res.data, format);
    if (!csv) return;
    downloadCsvFile(csv, filename);
    setExportWarnings(warnings || []);
    if (warnings?.length) {
      // Show a brief dismissible notice; auto-clear after 12 s
      setTimeout(() => setExportWarnings([]), 12000);
    }
  };

  const handleExportReceivables = () => {
    if (!receivables?.data?.length) return;
    const ageingLabel = {
      current: 'Current (within due date)',
      '1-30':  '1-30 days past due',
      '31-60': '31-60 days past due',
      '61-90': '61-90 days past due',
      '90+':   '90+ days past due',
    };
    const rows = receivables.data.map((inv) => ({
      InvoiceNumber: inv.invoiceNumber,
      Date: inv.date,
      DueDate: inv.dueDate || '',
      CustomerName: inv.customerName || '',
      CustomerEmail: inv.customerEmail || '',
      Currency: inv.currency || 'CAD',
      Status: inv.status || '',
      Total: (inv.total || 0).toFixed(2),
      DaysOverdue: inv.daysOverdue ?? '',
      Ageing: ageingLabel[inv.ageing] || inv.ageing || '',
    }));
    downloadCSV(rows, `account-receivables-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportTravelRecords = () => {
    if (!travelRegisterRecords.length) return;
    const rows = travelRegisterRecords.map((r) => ({
      TravelDate: r.travelDate || '',
      InvoiceNumber: r.invoiceNumber || '',
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
  const canMaker = canCreateInvoice;
  const canChecker = canApproveInvoice;
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
        ? 'Sign, send to customers, and view all organization invoices.'
        : isMc
          ? 'Organization-wide view: drafts in workflow, approved items, and invoices sent to customers; use Pending approval for maker submissions.'
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
          <button onClick={handleLogout} style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.08)', color: 'var(--cream)', border: '1.5px solid rgba(255,255,255,0.22)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.borderColor = 'var(--gold)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}>
            <LogOut size={16} /> Sign out
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
          {isMc && canApproveInvoice && (
            <button
              type="button"
              onClick={() => setDashboardTab('pending-approval')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 18px',
                border: 'none',
                borderBottom: dashboardTab === 'pending-approval' ? '3px solid var(--gold)' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: dashboardTab === 'pending-approval' ? '700' : '500',
                color: dashboardTab === 'pending-approval' ? 'var(--navy)' : 'var(--text-muted)',
                fontSize: '14px',
                marginBottom: '-1px',
              }}
            >
              <FileCheck size={18} /> Pending approval
            </button>
          )}
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

        {dashboardTab === 'pending-approval' && isMc && canApproveInvoice && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px', minHeight: '280px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>Invoices pending approval</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0', maxWidth: '720px', lineHeight: 1.5 }}>
              Drafts submitted by a maker are listed here until you sign and send them to the customer.
            </p>
            {(() => {
              const pending = (allInvoicesKpi || []).filter((inv) => inv.approvalState === 'pending_checker');
              if (pending.length === 0) {
                return <p style={{ color: '#666', fontSize: '14px' }}>Nothing waiting for approval.</p>;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pending.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #eee',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: '600' }}>{inv.invoiceNumber}</span>
                        <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>{inv.customerName}</span>
                        <span style={{ marginLeft: '8px', fontWeight: '600' }}>{formatInvoiceMoney(inv.total || 0, inv.currency || DEFAULT_INVOICE_CURRENCY)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/invoice/approve/${inv.id}`)}
                        style={{
                          padding: '8px 14px',
                          background: 'var(--navy)',
                          color: 'var(--cream)',
                          border: '1px solid var(--gold)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '13px',
                        }}
                      >
                        Sign &amp; send
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
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
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', flex: 1 }}>
                <MapPin size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px', marginBottom: '12px' }}>No travel records yet.</p>
                <button type="button" onClick={() => navigate('/travel')} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--navy)', background: 'var(--cream-dark)', border: '1.5px solid var(--cream-mid)', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}>Open travel estimator →</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {travelRegisterRecords.map((rec) => (
                  <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>{(rec.roundTripKm != null ? Number(rec.roundTripKm) : (rec.distanceKm != null ? Number(rec.distanceKm) : 0)).toFixed(1)} km</span>
                      <span style={{ marginLeft: '8px', color: '#666' }}>{rec.travelDate}</span>
                      {rec.invoiceNumber && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => rec.invoiceId && navigate(`/invoices/${rec.invoiceId}`)}
                          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && rec.invoiceId) navigate(`/invoices/${rec.invoiceId}`); }}
                          style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--gold-dark)', fontWeight: '500', cursor: rec.invoiceId ? 'pointer' : 'default' }}
                          title={rec.invoiceId ? 'Open invoice' : undefined}
                        >
                          #{rec.invoiceNumber}
                        </span>
                      )}
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
              <button type="button" onClick={handleExportTravelRecords} disabled={!travelRegisterRecords.length} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', color: travelRegisterRecords.length ? 'var(--navy)' : 'var(--text-muted)', border: '1.5px solid var(--cream-mid)', borderRadius: '8px', cursor: travelRegisterRecords.length ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '600', transition: 'all 0.18s' }} onMouseEnter={(e) => { if (travelRegisterRecords.length) { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.background = 'var(--cream-dark)'; } }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--cream-mid)'; e.currentTarget.style.background = 'transparent'; }}>
                <Download size={14} /> Download CSV
              </button>
            </div>
          </div>
        )}

        {dashboardTab === 'overview' && (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          <div style={{ background: 'var(--white)', padding: '22px 24px', borderRadius: '12px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--cream-mid)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--navy)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={22} color="var(--gold)" />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 3px 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total invoices</p>
              <p style={{ fontSize: '26px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', lineHeight: 1.1 }}>{stats?.totalInvoices || 0}</p>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div style={{ background: 'var(--white)', padding: '22px 24px', borderRadius: '12px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--cream-mid)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'var(--success-bg)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <TrendingUp size={22} color="var(--success)" />
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 3px 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue ({code})</p>
                      <p style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', lineHeight: 1.1 }}>{formatInvoiceMoney(revenue, code)}</p>
                    </div>
                  </div>
                  {showArCash && (
                    <div style={{ background: 'var(--white)', padding: '22px 24px', borderRadius: '12px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--cream-mid)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', background: 'var(--warning-bg)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <DollarSign size={22} color="var(--warning)" />
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 3px 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receivable ({code})</p>
                        <p style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', lineHeight: 1.1 }}>{formatInvoiceMoney(arAmt, code)}</p>
                      </div>
                    </div>
                  )}
                  {showArCash && (
                    <div style={{ background: 'var(--white)', padding: '22px 24px', borderRadius: '12px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--cream-mid)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', background: 'var(--gold-soft)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <DollarSign size={22} color="var(--gold-dark)" />
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 3px 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collected ({code})</p>
                        <p style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', lineHeight: 1.1 }}>{formatInvoiceMoney(cashAmt, code)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 20px 0', color: 'var(--text-primary)' }}>Quick actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <button
              type="button"
              onClick={() => (canCreateInvoice ? navigate('/invoice') : null)}
              disabled={!canCreateInvoice}
              title={!canCreateInvoice ? 'Your role cannot create or edit invoices.' : undefined}
              style={{
                padding: '20px',
                background: canCreateInvoice ? 'var(--gradient-navy)' : 'var(--cream-mid)',
                color: canCreateInvoice ? 'var(--cream)' : 'var(--text-muted)',
                border: canCreateInvoice ? '1.5px solid var(--gold)' : '1.5px solid var(--cream-deep)',
                borderRadius: '12px',
                cursor: canCreateInvoice ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { if (canCreateInvoice) e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,42,66,0.28)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <FileText size={20} color={canCreateInvoice ? 'var(--gold)' : 'var(--text-muted)'} />
              </div>
              <p style={{ fontWeight: '700', margin: '0 0 4px 0', fontSize: '15px' }}>Invoice</p>
              <p style={{ fontSize: '13px', opacity: 0.85, margin: 0, lineHeight: 1.5 }}>
                {canCreateInvoice ? 'Create, edit, approve, or send — depending on your role.' : 'Only makers and admins can create or edit invoices in maker–checker mode.'}
              </p>
            </button>
            <button onClick={() => navigate('/travel')} style={{ padding: '20px', background: 'var(--white)', color: 'var(--navy)', border: '1.5px solid var(--cream-mid)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(20,42,66,0.10)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--cream-mid)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: '40px', height: '40px', background: 'var(--gold-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <MapPin size={20} color="var(--gold-dark)" />
              </div>
              <p style={{ fontWeight: '700', margin: '0 0 4px 0', fontSize: '15px' }}>Travel register</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Business trips and costs for sales calls, service visits, and billing.</p>
            </button>
            <button onClick={() => navigate('/setup-company')} style={{ padding: '20px', background: 'var(--white)', color: 'var(--navy)', border: '1.5px solid var(--cream-mid)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(20,42,66,0.10)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--cream-mid)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(20,42,66,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Building size={20} color="var(--navy)" />
              </div>
              <p style={{ fontWeight: '700', margin: '0 0 4px 0', fontSize: '15px' }}>Business profile</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Company information and verification; Admins manage teammates from setup.</p>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: persona === 'checker' ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Invoice history</h2>
              {/* ── Export dropdown ─────────────────────────────────────── */}
              <div ref={exportDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setExportDropdownOpen((o) => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 13px', background: 'transparent',
                    color: 'var(--navy)', border: '1.5px solid var(--cream-mid)',
                    borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                    fontWeight: '600', transition: 'all 0.18s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.background = 'var(--cream-dark)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--cream-mid)'; e.currentTarget.style.background = 'transparent'; }}
                  aria-haspopup="true"
                  aria-expanded={exportDropdownOpen}
                >
                  <Download size={14} />
                  Export
                  <ChevronDown size={13} style={{ marginLeft: '2px', transition: 'transform 0.2s', transform: exportDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {exportDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: 'white', border: '1.5px solid var(--cream-mid)',
                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(20,42,66,0.12)',
                    minWidth: '210px', zIndex: 200, overflow: 'hidden',
                  }}>
                    {/* Header label */}
                    <div style={{ padding: '8px 14px 6px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', borderBottom: '1px solid var(--cream-mid)' }}>
                      Export format
                    </div>

                    {/* Platform CSV */}
                    <button
                      onClick={() => handleExportInvoiceHistory('platform')}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '2px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cream-dark)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <span style={{ fontWeight: '600' }}>📄 Platform CSV</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Standard flat export — one row per invoice</span>
                    </button>

                    {/* Xero */}
                    <button
                      onClick={() => handleExportInvoiceHistory('xero')}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid var(--cream-mid)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cream-dark)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <span style={{ fontWeight: '600' }}>🟦 Xero import CSV</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Line-item rows · YYYY-MM-DD · AccountCode</span>
                    </button>

                    {/* QuickBooks */}
                    <button
                      onClick={() => handleExportInvoiceHistory('qbo')}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid var(--cream-mid)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cream-dark)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <span style={{ fontWeight: '600' }}>🟩 QuickBooks import CSV</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Line-item rows · MM/DD/YYYY · Item columns</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* ── Export warnings banner ─────────────────────────────── */}
            {exportWarnings.length > 0 && (
              <div style={{
                margin: '0 0 12px',
                padding: '12px 14px',
                background: 'var(--warning-bg, #fffbeb)',
                border: '1.5px solid #f59e0b',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#92400e',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>⚠️ Import notes — review before uploading</strong>
                    <ul style={{ paddingLeft: '18px', margin: 0 }}>
                      {exportWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                  <button onClick={() => setExportWarnings([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#92400e', marginLeft: '10px', flexShrink: 0 }}>✕</button>
                </div>
              </div>
            )}

            {invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                <FileText size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px', marginBottom: '12px' }}>No invoices yet.</p>
                {canCreateInvoice && <button type="button" onClick={() => navigate('/invoice')} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--navy)', background: 'var(--cream-dark)', border: '1.5px solid var(--cream-mid)', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}>Create your first invoice →</button>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invoices.map((inv) => {
                  const showSubmit =
                    isMc &&
                    canMaker &&
                    inv.status === 'draft' &&
                    inv.approvalState !== 'pending_checker' &&
                    inv.approvalState !== 'approved';
                  const showSignSend = isMc && canChecker && inv.approvalState === 'pending_checker';
                  // showIssue means the draft was approved and awaits signing+issue.
                  // Always navigate to CheckerInvoiceApprove so signature is captured before issuance.
                  const showIssue =
                    isMc &&
                    canChecker &&
                    inv.status === 'draft' &&
                    inv.approvalState === 'approved';
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
                        {/* Status pill */}
                        {(() => {
                          const s = inv.status;
                          const pillStyle = {
                            fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.04em',
                            ...(s === 'draft' ? { background: 'var(--cream-dark)', color: 'var(--text-muted)' }
                              : s === 'sent' || s === 'viewed' ? { background: 'var(--info-bg)', color: 'var(--info)' }
                              : s === 'accepted' ? { background: 'var(--success-light)', color: 'var(--success)' }
                              : s === 'paid' ? { background: 'var(--gold-soft)', color: 'var(--gold-dark)' }
                              : s === 'contested' ? { background: 'var(--danger-light)', color: 'var(--danger)' }
                              : s === 'overdue' ? { background: 'var(--warning-bg)', color: 'var(--warning)' }
                              : { background: 'var(--cream-mid)', color: 'var(--text-muted)' }),
                          };
                          return <span style={pillStyle}>{s}</span>;
                        })()}
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>{formatInvoiceMoney(inv.total || 0, inv.currency || DEFAULT_INVOICE_CURRENCY)}</span>
                        {showSubmit && (
                          <button type="button" disabled={busy} onClick={() => runInvoiceWorkflow(inv.id, submitInvoiceForApproval)} style={{ padding: '5px 11px', background: 'var(--navy)', color: 'var(--cream)', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '12px', fontWeight: '600' }}>Submit for approval</button>
                        )}
                        {showSignSend && (
                          <button type="button" disabled={busy} onClick={() => navigate(`/invoice/approve/${inv.id}`)} style={{ padding: '5px 11px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Sign &amp; send</button>
                        )}
                        {showIssue && (
                          <button type="button" onClick={() => navigate(`/invoice/approve/${inv.id}`)} style={{ padding: '5px 11px', background: 'var(--gold-dark)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Sign &amp; send</button>
                        )}
                        {persona !== 'checker' && inv.status === 'paid' && !inv.workerConfirmedReceiptAt && (
                          <button type="button" onClick={() => handleConfirmReceipt(inv.id)} style={{ padding: '5px 11px', background: 'var(--navy)', color: 'var(--cream)', border: '1px solid var(--gold)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Confirm receipt</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {canCreateInvoice && (
              <button type="button" onClick={() => navigate('/invoice')} style={{ marginTop: '12px', fontSize: '14px', color: 'var(--gold-dark)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Open invoice →</button>
            )}
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
                  {[
                    { key: 'current', label: 'Current (within due date)' },
                    { key: '1-30',   label: '1–30 days past due' },
                    { key: '31-60',  label: '31–60 days past due' },
                    { key: '61-90',  label: '61–90 days past due' },
                    { key: '90+',    label: '90+ days past due' },
                  ].map(({ key, label }) => {
                    const list = receivables.byAgeing?.[key] || [];
                    const byCur = totalsByCurrency(list);
                    const line = formatTotalsByCurrencyLines(byCur);
                    const isOverdue = key !== 'current';
                    return (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: isOverdue && list.length > 0 ? (key === '90+' ? 'var(--danger-light, #fee2e2)' : 'var(--warning-bg, #fffbeb)') : '#f8f9fa', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontWeight: '500', fontSize: '13px', color: isOverdue && list.length > 0 ? (key === '90+' ? 'var(--danger)' : 'var(--warning)') : 'var(--text-primary)' }}>{label}</span>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>{line || '—'} <span style={{ color: '#666', fontWeight: '500' }}>({list.length})</span></span>
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
