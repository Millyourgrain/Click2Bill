import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Download } from 'lucide-react';
import {
  getInvoiceForCustomer,
  updateInvoiceStatus,
  getInvoiceForPublicPortal,
  updateInvoiceViaPortalToken,
} from '../../services/invoiceService';
import { notifyInvoiceOrgMembers } from '../../services/notificationService';
import { DEFAULT_INVOICE_CURRENCY } from '../../utils/invoiceCurrency';
import { downloadStoredInvoicePdf } from '../../utils/invoicePdf';
import StoredInvoicePreview from '../invoice/StoredInvoicePreview';

/**
 * @param {{ publicPortal?: boolean }} props
 * publicPortal: opened from email link /invoice/view/:id?t=… — no login or customer profile.
 */
function CustomerInvoiceView({ publicPortal = false }) {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const [searchParams] = useSearchParams();
  const urlToken = publicPortal ? (searchParams.get('t') || '') : '';

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [contestComment, setContestComment] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const patchStatus = async (updates) => {
    if (publicPortal) {
      if (!urlToken) return { success: false, error: 'Missing token' };
      return updateInvoiceViaPortalToken(invoiceId, urlToken, updates);
    }
    return updateInvoiceStatus(invoiceId, updates);
  };

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    setError('');
    if (publicPortal) {
      if (!urlToken) {
        setLoading(false);
        setError('This link is incomplete. Open the invoice from the email your supplier sent you.');
        return;
      }
      const result = await getInvoiceForPublicPortal(invoiceId);
      if (!result.success) {
        setLoading(false);
        setError(result.error || 'Invoice not found');
        return;
      }
      if (result.data.portalToken !== urlToken) {
        setLoading(false);
        setError('Invalid or outdated link. Ask your supplier for a new invoice email.');
        return;
      }
      let row = { ...result.data, id: invoiceId };
      if (result.data.status === 'sent' && !result.data.viewedAt) {
        const viewedAt = new Date().toISOString();
        await updateInvoiceViaPortalToken(invoiceId, urlToken, { status: 'viewed', viewedAt });
        row = { ...row, status: 'viewed', viewedAt };
        await notifyInvoiceOrgMembers(row, {
          type: 'invoice_viewed',
          title: 'Invoice viewed',
          body: `Customer/Payor viewed invoice ${result.data.invoiceNumber}`,
        });
      }
      setInvoice(row);
      setLoading(false);
      return;
    }

    const result = await getInvoiceForCustomer(invoiceId);
    setLoading(false);
    if (result.success) {
      let row = { ...result.data, id: invoiceId };
      if (result.data.status === 'sent' && !result.data.viewedAt) {
        const viewedAt = new Date().toISOString();
        await updateInvoiceStatus(invoiceId, { status: 'viewed', viewedAt });
        row = { ...row, status: 'viewed', viewedAt };
        await notifyInvoiceOrgMembers(row, {
          type: 'invoice_viewed',
          title: 'Invoice viewed',
          body: `Customer/Payor viewed invoice ${result.data.invoiceNumber}`,
        });
      }
      setInvoice(row);
    } else {
      setError(result.error || 'Invoice not found');
    }
  }, [invoiceId, publicPortal, urlToken]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleAccept = async () => {
    setAction('accept');
    setError('');
    const acceptedAt = new Date().toISOString();
    const result = await patchStatus({ status: 'accepted', acceptedAt });
    if (result.success) {
      const updated = { ...invoice, status: 'accepted', acceptedAt };
      setInvoice(updated);
      setSuccess('You accepted the charges. A PDF copy should download shortly.');
      await notifyInvoiceOrgMembers(updated, {
        type: 'invoice_accepted',
        title: 'Invoice accepted',
        body: `Customer/Payor accepted invoice ${invoice.invoiceNumber}. Due date: ${invoice.dueDate || 'as per invoice'}`,
      });
      setPdfBusy(true);
      try {
        await downloadStoredInvoicePdf({ ...updated, id: invoiceId }, { previewElId: 'stored-invoice-preview' });
      } catch (e) {
        console.warn(e);
      } finally {
        setPdfBusy(false);
      }
    } else {
      setError(result.error || 'Failed to accept');
    }
    setAction(null);
  };

  const handleDownloadOnly = async () => {
    if (!invoice) return;
    setPdfBusy(true);
    setError('');
    try {
      await downloadStoredInvoicePdf({ ...invoice, id: invoiceId }, { previewElId: 'stored-invoice-preview' });
    } catch (e) {
      setError('Could not generate PDF. Try again or use Print from your browser.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleContest = async (e) => {
    e.preventDefault();
    if (!contestComment.trim()) {
      setError('Please provide a comment for the issuer.');
      return;
    }
    setAction('contest');
    setError('');
    const result = await patchStatus({ status: 'contested', customerCommentary: contestComment.trim() });
    if (result.success) {
      const updated = { ...invoice, status: 'contested', customerCommentary: contestComment.trim() };
      setInvoice(updated);
      setSuccess('Your feedback was sent. The issuer may revise the invoice and send a new link.');
      await notifyInvoiceOrgMembers(updated, {
        type: 'invoice_contested',
        title: 'Invoice contested',
        body: `Customer/Payor contested invoice ${invoice.invoiceNumber}. Comment: ${contestComment.trim().slice(0, 120)}${contestComment.trim().length > 120 ? '…' : ''}`,
        metadata: { invoiceId, customerCommentary: contestComment.trim() },
      });
      setContestComment('');
    } else {
      setError(result.error || 'Failed to submit');
    }
    setAction(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid var(--cream-mid)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: 'var(--cream)', minHeight: '100vh' }}>
        <p style={{ color: '#dc3545', marginBottom: '16px', maxWidth: '480px', margin: '0 auto 16px' }}>{error}</p>
        {!publicPortal && (
          <button type="button" onClick={() => navigate('/customer-dashboard')} style={{ padding: '10px 20px', background: 'var(--gradient-navy)', color: 'var(--cream)', border: '1px solid var(--gold)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Back to dashboard</button>
        )}
      </div>
    );
  }

  const canAcceptOrContest = invoice?.status === 'sent' || invoice?.status === 'viewed';
  const canConfirmPayment = invoice?.status === 'accepted' && !invoice?.paidAt;

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    setConfirmingPayment(true);
    setError('');
    const paidAt = new Date().toISOString();
    const result = await patchStatus({ status: 'paid', paidAt, paymentReference: paymentRef.trim() || null });
    setConfirmingPayment(false);
    if (result.success) {
      const updated = { ...invoice, status: 'paid', paidAt };
      setInvoice(updated);
      setSuccess('Payment confirmed. The issuer will be notified.');
      await notifyInvoiceOrgMembers(updated, {
        type: 'payment_confirmed',
        title: 'Payment confirmed by customer',
        body: `Customer confirmed payment for invoice ${invoice.invoiceNumber}${paymentRef.trim() ? `. Reference: ${paymentRef.trim()}` : ''}`,
      });
    } else setError(result.error || 'Failed to confirm');
  };

  const inv = invoice || {};
  const invCur = inv.currency || DEFAULT_INVOICE_CURRENCY;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {!publicPortal && (
          <button type="button" onClick={() => navigate('/customer-dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--gold-dark)', fontWeight: '600' }}>
            <ArrowLeft size={18} /> Back to dashboard
          </button>
        )}
        {publicPortal && (
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>You are viewing a secure invoice link. Sign-in is not required to accept, contest, or download.</p>
        )}

        {error && <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}

        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Invoice {inv.invoiceNumber}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            From: {inv.legalBusinessName || inv.companyName} • Date: {inv.date} • Due: {inv.dueDate || '–'} • Currency: <strong>{invCur}</strong> • Status: <strong>{inv.status}</strong>
          </p>

          {inv.status === 'contested' && inv.customerCommentary && (
            <div style={{ marginBottom: '24px', padding: '16px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <strong>Your message to the issuer</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{inv.customerCommentary}</p>
            </div>
          )}

          {canAcceptOrContest && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Respond to this invoice</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                Accept if the charges are correct (a PDF will download). Or contest and explain what should change — the issuer can amend and send a new link.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
                <button type="button" onClick={handleAccept} disabled={!!action || pdfBusy} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: action || pdfBusy ? '#94a3b8' : 'var(--gradient-navy)', color: 'var(--cream)', border: action || pdfBusy ? 'none' : '1px solid var(--gold)', borderRadius: '8px', cursor: action || pdfBusy ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  <CheckCircle size={20} /> Accept &amp; download invoice
                </button>
                <button type="button" onClick={handleDownloadOnly} disabled={pdfBusy || !!action} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: pdfBusy || action ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  <Download size={18} /> Download PDF only
                </button>
              </div>
              <form onSubmit={handleContest}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Contest — add a comment for the issuer</label>
                <textarea value={contestComment} onChange={(e) => setContestComment(e.target.value)} rows={3} placeholder="Describe what should be corrected or discussed..." style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }} />
                <button type="submit" disabled={!!action || !contestComment.trim()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: action || !contestComment.trim() ? '#cbd5e1' : '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: action || !contestComment.trim() ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  <XCircle size={20} /> Contest &amp; send commentary
                </button>
              </form>
            </div>
          )}

          {inv.status === 'accepted' && (
            <div style={{ marginTop: '20px' }}>
              <button type="button" onClick={handleDownloadOnly} disabled={pdfBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: pdfBusy ? 'wait' : 'pointer', fontWeight: '600', color: '#334155' }}>
                <Download size={18} /> Download PDF again
              </button>
            </div>
          )}

          {inv.status === 'contested' && inv.customerCommentary && (
            <div style={{ marginTop: '24px', padding: '16px', background: '#fef3c7', borderRadius: '8px' }}>
              <strong>Your comment (sent to issuer):</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>{inv.customerCommentary}</p>
            </div>
          )}

          {canConfirmPayment && (
            <div style={{ marginTop: '24px', padding: '20px', background: 'var(--cream-dark)', borderRadius: '12px', border: '1px solid var(--gold)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Confirm payment</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>Have you paid? Confirm below (optional: add transaction reference). The issuer will be notified.</p>
              <form onSubmit={handleConfirmPayment}>
                <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Transaction reference (optional)" style={{ width: '100%', maxWidth: '320px', padding: '10px', border: '2px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px' }} />
                <button type="submit" disabled={confirmingPayment} style={{ padding: '10px 20px', background: confirmingPayment ? '#94a3b8' : 'var(--gradient-navy)', color: 'var(--cream)', border: confirmingPayment ? 'none' : '1px solid var(--gold)', borderRadius: '8px', cursor: confirmingPayment ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  {confirmingPayment ? 'Confirming...' : 'Confirm payment'}
                </button>
              </form>
            </div>
          )}

          <p style={{ marginTop: '24px', fontSize: '13px', color: '#64748b' }}>
            Pay via direct deposit or as agreed with the issuer. The formatted invoice below matches the issuer template and is included when you download PDF.
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <StoredInvoicePreview inv={inv} rootId="stored-invoice-preview" />
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default CustomerInvoiceView;
