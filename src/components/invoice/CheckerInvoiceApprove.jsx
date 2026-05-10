import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, FileCheck, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanyInfo } from '../../services/companyService';
import {
  getInvoice,
  updateInvoice,
  approveInvoiceAsChecker,
  issueInvoiceToCustomer,
  generateInvoicePortalToken,
  returnInvoiceToMakerWithRecommendation,
} from '../../services/invoiceService';
import { sendEmail } from '../../services/emailService';
import { formatInvoiceMoney, DEFAULT_INVOICE_CURRENCY, isCadCurrency } from '../../utils/invoiceCurrency';
import { buildInvoiceSummaryHtml, downloadStoredInvoicePdf } from '../../utils/invoicePdf';

/**
 * Checker / admin: sign a maker-submitted invoice and issue to customer (maker–checker orgs).
 */
function CheckerInvoiceApprove() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { currentUser, canApproveInvoice } = useAuth();
  const [companyInfo, setCompanyInfo] = useState(null);
  const [invoiceRow, setInvoiceRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('sign');
  const [signatoryTitle, setSignatoryTitle] = useState('Checker (approver)');
  const [signatoryPrintedName, setSignatoryPrintedName] = useState('');
  const [signature, setSignature] = useState(null);
  const [signatorySignedAt, setSignatorySignedAt] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState('15_before_due');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnBusy, setReturnBusy] = useState(false);
  const signatureRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError('');
      const [co, inv] = await Promise.all([getCompanyInfo(), getInvoice(invoiceId)]);
      if (cancel) return;
      if (!co.success || !co.data || co.data.invoiceSystem !== 'maker_checker') {
        setError('This action is only available for maker–checker organizations.');
        setLoading(false);
        return;
      }
      if (!inv.success || !inv.data) {
        setError(inv.error || 'Invoice not found');
        setLoading(false);
        return;
      }
      const row = inv.data;
      if (row.approvalState !== 'pending_checker') {
        setError('This invoice is not waiting for checker approval.');
        setLoading(false);
        return;
      }
      setCompanyInfo(co.data);
      setInvoiceRow({ ...row, id: invoiceId });
      const name =
        (currentUser?.fullName && String(currentUser.fullName).trim()) ||
        currentUser?.displayName ||
        currentUser?.email ||
        '';
      setSignatoryPrintedName(name);
      setSignatoryTitle('Checker (approver)');
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [invoiceId, currentUser?.fullName, currentUser?.displayName, currentUser?.email]);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
    setSignatorySignedAt(null);
  };

  const saveSignatureFromCanvas = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    setSignature(canvas.toDataURL());
    setSignatorySignedAt(new Date().toISOString().split('T')[0]);
    setStep('delivery');
  };

  const calculateSubtotal = (inv) => (inv.items || []).reduce((s, it) => s + (it.amount || 0), 0);
  const calculateTravelTotal = (inv) => (inv.travelItems || []).reduce((s, t) => s + (t.amount || 0), 0);
  const calculateTax = (inv) => {
    if (isCadCurrency(inv.currency || DEFAULT_INVOICE_CURRENCY)) {
      return calculateSubtotal(inv) * ((inv.taxRate || 0) / 100);
    }
    return Math.max(0, parseFloat(inv.manualTaxAmount) || 0);
  };
  const calculateTotal = (inv) => calculateSubtotal(inv) + calculateTax(inv) + calculateTravelTotal(inv);

  const runReturnToMaker = async () => {
    if (!invoiceId) return;
    const trimmed = returnNotes.trim();
    if (!trimmed) {
      alert('Please enter recommendations or required changes for the maker.');
      return;
    }
    setReturnBusy(true);
    try {
      const res = await returnInvoiceToMakerWithRecommendation(invoiceId, trimmed);
      if (res.success) {
        alert('The draft has been sent back to the maker with your notes.');
        navigate('/dashboard', { replace: true });
      } else {
        alert(res.error || 'Could not return to maker.');
      }
    } catch (e) {
      console.error(e);
      alert('Something went wrong.');
    } finally {
      setReturnBusy(false);
    }
  };

  const buildInvoiceView = () => {
    const inv = invoiceRow;
    if (!inv) return null;
    return {
      invoice: {
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        dueDate: inv.dueDate,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        serviceAddress: inv.serviceAddress,
        items: inv.items || [],
        travelItems: inv.travelItems || [],
        currency: inv.currency || DEFAULT_INVOICE_CURRENCY,
        notes: inv.notes,
        taxRate: inv.taxRate ?? 13,
        manualTaxAmount: inv.manualTaxAmount,
      },
      subtotal: inv.subtotal ?? calculateSubtotal(inv),
      tax: inv.tax ?? calculateTax(inv),
      travelTotal: inv.travelTotal ?? calculateTravelTotal(inv),
      total: inv.total ?? calculateTotal(inv),
    };
  };

  const sendInvoiceEmailAfterIssue = async (docId) => {
    const inv = invoiceRow;
    if (!inv) return;
    const emailTo = inv.payorEmail || inv.customerEmail;
    if (!emailTo) {
      alert('No customer or payor email on the invoice.');
      return;
    }
    const v = buildInvoiceView();
    const subject = `Invoice ${inv.invoiceNumber} from ${companyInfo?.companyName || companyInfo?.legalBusinessName || 'Your Company'}`;
    let invoiceLink = '';
    let portalToken = inv.portalToken || null;
    if (!portalToken) {
      portalToken = generateInvoicePortalToken();
      await updateInvoice(docId, { portalToken });
    }
    invoiceLink = `${window.location.origin}/invoice/view/${docId}?t=${encodeURIComponent(portalToken)}`;
    const supplier = companyInfo?.companyName || companyInfo?.legalBusinessName || 'Your supplier';
    const text =
      `Dear ${inv.customerName},\n\nInvoice ${inv.invoiceNumber} is ready from ${supplier}.\n\nTotal: ${formatInvoiceMoney(v.total, inv.currency)}\n\nOpen your invoice (no account required — accept, contest, or download):\n${invoiceLink}\n\nThank you,\n${supplier}`;
    const html = buildInvoiceSummaryHtml({
      invoice: v.invoice,
      companyInfo,
      subtotal: v.subtotal,
      tax: v.tax,
      travelTotal: v.travelTotal,
      total: v.total,
      invoiceLink,
      linkOnly: true,
    });
    const res = await sendEmail({ to: emailTo, subject, text, html });
    if (res.success) alert('Invoice sent successfully!');
    else alert(res.error || 'Failed to send email.');
  };

  const runIssueFlow = async (method) => {
    if (!invoiceId || !signature || !invoiceRow || !canApproveInvoice) return;
    setBusy(true);
    try {
      const upd = await updateInvoice(invoiceId, {
        signature,
        signatoryTitle: (signatoryTitle && String(signatoryTitle).trim()) || 'Checker (approver)',
        signatoryPrintedName: (signatoryPrintedName && signatoryPrintedName.trim()) || currentUser?.email || '',
        signatorySignedAt: signatorySignedAt || invoiceRow.date || null,
        reminderEnabled: !!reminderEnabled,
        reminderFrequency: reminderEnabled ? reminderFrequency : null,
      });
      if (!upd.success) {
        alert(upd.error || 'Could not save signature.');
        setBusy(false);
        return;
      }
      const ap = await approveInvoiceAsChecker(invoiceId);
      if (!ap.success) {
        alert(ap.error || 'Could not approve invoice.');
        setBusy(false);
        return;
      }
      const iss = await issueInvoiceToCustomer(invoiceId);
      if (!iss.success) {
        alert(iss.error || 'Could not issue invoice.');
        setBusy(false);
        return;
      }
      // Refresh invoice from Firestore so portalToken written by issueInvoiceToCustomer is up to date
      const freshAfterIssue = await getInvoice(invoiceId);
      if (freshAfterIssue.success && freshAfterIssue.data) {
        setInvoiceRow({ ...freshAfterIssue.data, id: invoiceId });
      }
      if (method === 'email') {
        await sendInvoiceEmailAfterIssue(invoiceId);
      } else {
        const fresh = await getInvoice(invoiceId);
        if (fresh.success && fresh.data) {
          await downloadStoredInvoicePdf({ ...fresh.data, id: invoiceId }, { previewEl: null });
        }
      }
      navigate('/dashboard', { replace: true });
    } catch (e) {
      console.error(e);
      alert('Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading…</div>
      </div>
    );
  }

  if (error || !invoiceRow || !canApproveInvoice) {
    return (
      <div className="main-content" style={{ padding: '40px 24px', maxWidth: '560px', margin: '0 auto' }}>
        <p style={{ color: '#b91c1c', marginBottom: '16px' }}>{error || (!canApproveInvoice ? 'You do not have permission to approve and send invoices.' : 'Unavailable')}</p>
        <Link to="/dashboard" style={{ color: 'var(--gold-dark)', fontWeight: 600 }}>Back to dashboard</Link>
      </div>
    );
  }

  const v = buildInvoiceView();
  const cur = invoiceRow.currency || DEFAULT_INVOICE_CURRENCY;

  return (
    <div className="main-content">
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 16px' }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold-dark)', fontWeight: 600 }}
        >
          <ArrowLeft size={18} /> Back
        </button>

        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Approve &amp; send invoice {invoiceRow.invoiceNumber}</h1>
        <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '24px', lineHeight: 1.5 }}>
          Sign as checker, then deliver to the customer. The maker has already submitted this draft for approval.
        </p>

        <div
          style={{
            marginBottom: '28px',
            padding: '18px 20px',
            background: '#fefce8',
            border: '1px solid #eab308',
            borderRadius: '12px',
            maxWidth: '640px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: '#854d0e' }}>
            Return to maker for changes
          </h2>
          <p style={{ fontSize: '14px', color: '#713f12', margin: '0 0 12px', lineHeight: 1.5 }}>
            Recommend updates (line items, dates, wording, etc.). The maker can edit the draft and submit it again for your approval.
          </p>
          <textarea
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Please split travel on a separate line and set due date to Net 45."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '2px solid #e0e0e0',
              fontSize: '14px',
              marginBottom: '12px',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            disabled={returnBusy || busy}
            onClick={runReturnToMaker}
            style={{
              padding: '10px 18px',
              background: returnBusy || busy ? '#94a3b8' : '#b45309',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: returnBusy || busy ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            {returnBusy ? 'Sending back…' : 'Send back to maker'}
          </button>
        </div>

        {step === 'sign' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>Printed name</label>
              <input
                type="text"
                value={signatoryPrintedName}
                onChange={(e) => setSignatoryPrintedName(e.target.value)}
                style={{ width: '100%', maxWidth: '400px', padding: '10px 12px', borderRadius: '8px', border: '2px solid #e0e0e0', fontSize: '15px' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>Title</label>
              <input
                type="text"
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                style={{ width: '100%', maxWidth: '400px', padding: '10px 12px', borderRadius: '8px', border: '2px solid #e0e0e0', fontSize: '15px' }}
              />
            </div>
            <div className="signature-canvas-container" style={{ marginBottom: '16px' }}>
              <canvas
                ref={signatureRef}
                width={800}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="signature-canvas"
              />
            </div>
            <div className="button-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button type="button" onClick={clearSignature} className="secondary-button">Clear</button>
              <button type="button" onClick={saveSignatureFromCanvas} className="primary-button" disabled={busy}>
                Continue to delivery
              </button>
            </div>
          </>
        )}

        {step === 'delivery' && (
          <>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '20px' }}>
              Choose how to deliver. Email sends a secure portal link (same as the standard flow).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => runIssueFlow('email')}
                style={{
                  padding: '32px 24px',
                  background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-700) 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: busy ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Mail size={40} />
                Send link by email
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runIssueFlow('manual')}
                style={{
                  padding: '32px 24px',
                  background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: busy ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <FileCheck size={40} />
                Issue &amp; download PDF
              </button>
            </div>
            <div style={{ maxWidth: '500px', padding: '16px', background: '#f8f9fa', borderRadius: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
                <span style={{ fontWeight: 600 }}>Client reminder</span>
              </label>
              {reminderEnabled && (
                <select
                  value={reminderFrequency}
                  onChange={(e) => setReminderFrequency(e.target.value)}
                  style={{ marginTop: '10px', width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0' }}
                >
                  <option value="15_after_accept">Every 15 days after customer accepts invoice</option>
                  <option value="15_before_due">Only 15 days before payment due date</option>
                </select>
              )}
            </div>
            <button type="button" onClick={() => setStep('sign')} className="secondary-button" disabled={busy}>Back to signing</button>
          </>
        )}

        <div id="checker-approve-preview" style={{ marginTop: '32px', padding: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>Summary</h3>
          <p><strong>{v.invoice.customerName}</strong> · {formatInvoiceMoney(v.total, cur)}</p>
          <p style={{ color: '#64748b', marginBottom: 0 }}>{v.invoice.invoiceNumber} · due {v.invoice.dueDate || '—'}</p>
        </div>

        <div style={{ marginTop: '24px' }}>
          <button type="button" onClick={() => navigate('/dashboard')} className="secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Home size={18} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckerInvoiceApprove;
