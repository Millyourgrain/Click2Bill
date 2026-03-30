import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Download } from 'lucide-react';
import { getInvoice, deleteInvoice, canDeleteInvoiceForOrg, updateInvoice, generateInvoicePortalToken } from '../../services/invoiceService';
import { DEFAULT_INVOICE_CURRENCY } from '../../utils/invoiceCurrency';
import { downloadStoredInvoicePdf } from '../../utils/invoicePdf';
import StoredInvoicePreview from './StoredInvoicePreview';

/** Read-only invoice for workers; optional delete with audit commentary. */
function WorkerInvoiceDetail() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canDelete, setCanDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await getInvoice(invoiceId);
    setLoading(false);
    if (res.success) {
      setInvoice(res.data);
    } else {
      setError(res.error || 'Could not load invoice');
    }
    const perm = await canDeleteInvoiceForOrg();
    setCanDelete(!!perm.allowed);
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      await load();
      if (cancel) return;
    })();
    return () => { cancel = true; };
  }, [invoiceId]);

  const handleConfirmDelete = async () => {
    const comment = deleteReason.trim();
    if (!comment) {
      alert('Please enter a reason for deletion.');
      return;
    }
    setDeleteBusy(true);
    const res = await deleteInvoice(invoiceId, comment);
    setDeleteBusy(false);
    if (res.success) {
      navigate('/dashboard');
    } else {
      alert(res.error || 'Could not delete invoice');
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setPdfBusy(true);
    try {
      await downloadStoredInvoicePdf({ ...invoice, id: invoiceId }, { previewElId: 'stored-invoice-preview-worker' });
    } catch (e) {
      console.warn(e);
      alert('Could not generate PDF. Try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid var(--cream-mid)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: 'var(--cream)', minHeight: '100vh' }}>
        <p style={{ color: '#dc3545', marginBottom: '16px' }}>{error}</p>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: 'var(--gradient-navy)', color: 'var(--cream)', border: '1px solid var(--gold)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Back to dashboard</button>
      </div>
    );
  }

  const inv = invoice || {};
  const invCur = inv.currency || DEFAULT_INVOICE_CURRENCY;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--gold-dark)', fontWeight: '600' }}>
          <ArrowLeft size={18} /> Back to dashboard
        </button>

        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Invoice {inv.invoiceNumber}</h1>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: pdfBusy ? '#94a3b8' : 'var(--navy)', color: 'var(--cream)', border: '1px solid var(--gold)', borderRadius: '8px', cursor: pdfBusy ? 'wait' : 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              <Download size={18} /> {pdfBusy ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            From: {inv.legalBusinessName || inv.companyName} • Date: {inv.date} • Due: {inv.dueDate || '–'} • Currency: <strong>{invCur}</strong> • Status: <strong>{inv.status}</strong>
          </p>

          {inv.customerCommentary && (
            <div style={{ marginBottom: '24px', padding: '16px 20px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700', color: '#9a3412' }}>Customer / payor feedback</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#431407', whiteSpace: 'pre-wrap' }}>{inv.customerCommentary}</p>
            </div>
          )}

          {['sent', 'viewed', 'accepted', 'contested', 'paid', 'overdue'].includes(inv.status) && (
            <div style={{ marginBottom: '24px', padding: '14px 16px', background: '#f1f5f9', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '8px', color: '#334155' }}>Customer portal link</div>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                Share this URL with the customer or payor. No account is required to open the invoice, accept, contest, or download a PDF.
              </p>
              {inv.portalToken ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    readOnly
                    value={`${window.location.origin}/invoice/view/${invoiceId}?t=${encodeURIComponent(inv.portalToken)}`}
                    style={{ flex: '1 1 260px', minWidth: '0', fontSize: '12px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const u = `${window.location.origin}/invoice/view/${invoiceId}?t=${encodeURIComponent(inv.portalToken)}`;
                      navigator.clipboard.writeText(u).then(() => alert('Link copied.')).catch(() => alert(u));
                    }}
                    style={{ padding: '10px 16px', background: 'var(--navy)', color: 'var(--cream)', border: '1px solid var(--gold)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >
                    Copy link
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={portalBusy}
                  onClick={async () => {
                    setPortalBusy(true);
                    const t = generateInvoicePortalToken();
                    const res = await updateInvoice(invoiceId, { portalToken: t });
                    if (res.success) await load();
                    else alert(res.error || 'Could not create link.');
                    setPortalBusy(false);
                  }}
                  style={{ padding: '10px 18px', background: portalBusy ? '#94a3b8' : '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: portalBusy ? 'wait' : 'pointer', fontWeight: '600', fontSize: '14px' }}
                >
                  {portalBusy ? 'Creating…' : 'Generate customer link'}
                </button>
              )}
            </div>
          )}

          {inv.status === 'contested' && (
            <div style={{ marginTop: '20px', padding: '16px 20px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#9a3412' }}>Invoice contested — amend and resend</h3>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#78350f' }}>Review the customer message above, then open the editor to revise line items and send a new link.</p>
              <Link
                to={`/invoice?editInvoiceId=${encodeURIComponent(invoiceId)}`}
                style={{
                  display: 'inline-block',
                  padding: '10px 18px',
                  background: 'var(--gradient-navy)',
                  color: 'var(--cream)',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  border: '1px solid var(--gold)',
                }}
              >
                Amend invoice &amp; resend link to customer
              </Link>
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#78716c' }}>
                Opens the invoice editor with this invoice loaded. Re-sign, preview, then send the invitation email again (link only — no PDF attachment).
              </p>
            </div>
          )}

          <p style={{ marginTop: '8px', fontSize: '13px', color: '#64748b' }}>
            This is your organization&apos;s copy. Customers open their link from email to accept or contest.
          </p>

          {canDelete && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => { setDeleteReason(''); setShowDeleteModal(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
              >
                <Trash2 size={18} /> Delete invoice
              </button>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0 0', maxWidth: '480px' }}>
                Only an organization admin (maker–checker) or authorized signatory may delete. Revenue and KPIs update automatically once the invoice is removed.
              </p>
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <StoredInvoicePreview inv={{ ...inv, id: invoiceId }} rootId="stored-invoice-preview-worker" />
        </div>
      </div>

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} role="dialog" aria-modal="true" aria-labelledby="delete-invoice-title">
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h2 id="delete-invoice-title" style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: '700' }}>Delete this invoice?</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
              This cannot be undone. Provide a short reason for your records (required).
            </p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion"
              rows={4}
              style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteBusy} style={{ padding: '10px 18px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: deleteBusy ? 'wait' : 'pointer', fontWeight: '600' }}>
                Cancel
              </button>
              <button type="button" onClick={handleConfirmDelete} disabled={deleteBusy} style={{ padding: '10px 18px', background: '#b91c1c', color: 'white', border: 'none', borderRadius: '8px', cursor: deleteBusy ? 'wait' : 'pointer', fontWeight: '600' }}>
                {deleteBusy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default WorkerInvoiceDetail;
