import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { getInvoiceForCustomer, updateInvoiceStatus } from '../../services/invoiceService';
import { addNotification } from '../../services/notificationService';

function CustomerInvoiceView() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [contestComment, setContestComment] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    setLoading(true);
    setError('');
    const result = await getInvoiceForCustomer(invoiceId);
    setLoading(false);
    if (result.success) {
      setInvoice(result.data);
      if (result.data.status === 'sent' && !result.data.viewedAt) {
        const viewedAt = new Date().toISOString();
        await updateInvoiceStatus(invoiceId, { status: 'viewed', viewedAt });
        if (result.data.userId) {
          await addNotification({
            userId: result.data.userId,
            type: 'invoice_viewed',
            title: 'Invoice viewed',
            body: `Customer/Payor viewed invoice ${result.data.invoiceNumber}`,
            link: `/invoice`,
            metadata: { invoiceId },
          });
        }
      }
    } else {
      setError(result.error || 'Invoice not found');
    }
  };

  const handleAccept = async () => {
    setAction('accept');
    setError('');
    const acceptedAt = new Date().toISOString();
    const result = await updateInvoiceStatus(invoiceId, { status: 'accepted', acceptedAt });
    if (result.success) {
      setInvoice((prev) => prev ? { ...prev, status: 'accepted', acceptedAt } : null);
      setSuccess('You have accepted the charges. Due date is as per the invoice.');
      if (invoice?.userId) {
        await addNotification({
          userId: invoice.userId,
          type: 'invoice_accepted',
          title: 'Invoice accepted',
          body: `Customer/Payor accepted invoice ${invoice.invoiceNumber}. Due date: ${invoice.dueDate || 'as per invoice'}`,
          link: `/invoice`,
          metadata: { invoiceId },
        });
      }
    } else {
      setError(result.error || 'Failed to accept');
    }
    setAction(null);
  };

  const handleContest = async (e) => {
    e.preventDefault();
    if (!contestComment.trim()) {
      setError('Please provide a comment for the worker.');
      return;
    }
    setAction('contest');
    setError('');
    const result = await updateInvoiceStatus(invoiceId, { status: 'contested', customerCommentary: contestComment.trim() });
    if (result.success) {
      setInvoice((prev) => prev ? { ...prev, status: 'contested', customerCommentary: contestComment.trim() } : null);
      setSuccess('Your feedback has been sent to the worker. They may revise the invoice or send a final version.');
      if (invoice?.userId) {
        await addNotification({
          userId: invoice.userId,
          type: 'invoice_contested',
          title: 'Invoice contested',
          body: `Customer/Payor contested invoice ${invoice.invoiceNumber}. Comment: ${contestComment.trim().slice(0, 80)}...`,
          link: `/invoice`,
          metadata: { invoiceId, customerCommentary: contestComment.trim() },
        });
      }
      setContestComment('');
    } else {
      setError(result.error || 'Failed to submit');
    }
    setAction(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0fdfa' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e0e0e0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#dc3545', marginBottom: '16px' }}>{error}</p>
        <button onClick={() => navigate('/customer-dashboard')} style={{ padding: '10px 20px', background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Back to dashboard</button>
      </div>
    );
  }

  const canAcceptOrContest = invoice?.status === 'sent' || invoice?.status === 'viewed';
  const canConfirmPayment = invoice?.status === 'accepted' && !invoice?.paidAt;
  const [paymentRef, setPaymentRef] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    setConfirmingPayment(true);
    setError('');
    const paidAt = new Date().toISOString();
    const result = await updateInvoiceStatus(invoiceId, { status: 'paid', paidAt, paymentReference: paymentRef.trim() || null });
    setConfirmingPayment(false);
    if (result.success) {
      setInvoice((prev) => prev ? { ...prev, status: 'paid', paidAt } : null);
      setSuccess('Payment confirmed. The worker will be notified.');
      if (invoice?.userId) {
        await addNotification({
          userId: invoice.userId,
          type: 'payment_confirmed',
          title: 'Payment confirmed by customer',
          body: `Customer confirmed payment for invoice ${invoice.invoiceNumber}${paymentRef.trim() ? `. Reference: ${paymentRef.trim()}` : ''}`,
          link: `/invoice`,
          metadata: { invoiceId },
        });
      }
    } else setError(result.error || 'Failed to confirm');
  };

  const inv = invoice || {};

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdfa', padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={() => navigate('/customer-dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#0d9488', fontWeight: '500' }}>
          <ArrowLeft size={18} /> Back to dashboard
        </button>

        {error && <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}

        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Invoice {inv.invoiceNumber}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            From: {inv.legalBusinessName || inv.companyName} • Date: {inv.date} • Due: {inv.dueDate || '–'} • Status: <strong>{inv.status}</strong>
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Bill from</div>
              <div style={{ fontWeight: '600' }}>{inv.legalBusinessName || inv.companyName}</div>
              {inv.operationalNameDba && <div style={{ fontSize: '14px', color: '#64748b' }}>DBA: {inv.operationalNameDba}</div>}
              {inv.companyAddress && <div style={{ fontSize: '14px', whiteSpace: 'pre-line' }}>{inv.companyAddress}</div>}
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Bill to</div>
              <div style={{ fontWeight: '600' }}>{inv.customerName}</div>
              <div>{inv.customerEmail}</div>
              {((inv.payorName && inv.payorName !== inv.customerName) || (inv.payorEmail && inv.payorEmail !== inv.customerEmail)) && (
                <div style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '2px' }}>Payor</div>
                  {inv.payorName && <div>{inv.payorName}</div>}
                  {inv.payorEmail && <div>{inv.payorEmail}</div>}
                </div>
              )}
              {inv.serviceAddress && <div style={{ fontSize: '14px', whiteSpace: 'pre-line', marginTop: '4px' }}>{inv.serviceAddress}</div>}
            </div>
          </div>

          {(inv.servicePeriodVisits || []).length > 0 && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #0d9488', fontSize: '13px' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>Service period</div>
              {(inv.servicePeriodVisits || []).map((v, idx) => {
                if (!v?.checkInTime || !v?.checkOutTime) return null;
                const d1 = new Date(v.checkInTime);
                const d2 = new Date(v.checkOutTime);
                const dayDate = d1.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                const t1 = d1.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
                const t2 = d2.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
                const line = `${dayDate} • Check-in: ${t1} • Check-out: ${t2}`;
                return <div key={idx} style={{ marginBottom: idx < inv.servicePeriodVisits.length - 1 ? '6px' : 0 }}>{line}</div>;
              })}
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px', fontSize: '13px', color: '#64748b' }}>Description</th>
                <th style={{ padding: '12px 8px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '12px 8px', fontSize: '13px', color: '#64748b', textAlign: 'right' }}>Rate</th>
                <th style={{ padding: '12px 8px', fontSize: '13px', color: '#64748b', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(inv.items || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 8px' }}>{item.description}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>${(item.rate || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>${(item.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
              {(inv.travelItems || []).map((item, i) => (
                <tr key={`t-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 8px' }}>{item.description}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{item.quantity ?? 1}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>–</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>${(item.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <div style={{ marginBottom: '8px' }}>Subtotal: ${(inv.subtotal || 0).toFixed(2)}</div>
            {(inv.taxRate || 0) > 0 && <div style={{ marginBottom: '8px' }}>Tax ({inv.taxRate}%): ${(inv.tax || 0).toFixed(2)}</div>}
            <div style={{ fontSize: '18px', fontWeight: '700' }}>Total: ${(inv.total || 0).toFixed(2)}</div>
          </div>

          {inv.notes && <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '24px', fontSize: '14px' }}>{inv.notes}</div>}

          {canAcceptOrContest && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Accept or contest this invoice</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <button onClick={handleAccept} disabled={!!action} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: action ? '#94a3b8' : '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: action ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  <CheckCircle size={20} /> Accept charges
                </button>
              </div>
              <form onSubmit={handleContest}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Or contest (add comment for the worker)</label>
                <textarea value={contestComment} onChange={(e) => setContestComment(e.target.value)} rows={3} placeholder="Explain what you’d like changed..." style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }} />
                <button type="submit" disabled={!!action || !contestComment.trim()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: action || !contestComment.trim() ? '#cbd5e1' : '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: action || !contestComment.trim() ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  <XCircle size={20} /> Contest and send to worker
                </button>
              </form>
            </div>
          )}

          {inv.status === 'contested' && inv.customerCommentary && (
            <div style={{ marginTop: '24px', padding: '16px', background: '#fef3c7', borderRadius: '8px' }}>
              <strong>Your comment (sent to worker):</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>{inv.customerCommentary}</p>
            </div>
          )}

          {canConfirmPayment && (
            <div style={{ marginTop: '24px', padding: '20px', background: '#f0fdfa', borderRadius: '12px', border: '1px solid #0d9488' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Confirm payment</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>Have you paid? Confirm below (optional: add transaction reference). The worker will be notified.</p>
              <form onSubmit={handleConfirmPayment}>
                <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Transaction reference (optional)" style={{ width: '100%', maxWidth: '320px', padding: '10px', border: '2px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px' }} />
                <button type="submit" disabled={confirmingPayment} style={{ padding: '10px 20px', background: confirmingPayment ? '#94a3b8' : '#0d9488', color: 'white', border: 'none', borderRadius: '8px', cursor: confirmingPayment ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                  {confirmingPayment ? 'Confirming...' : 'Confirm payment'}
                </button>
              </form>
            </div>
          )}

          <p style={{ marginTop: '24px', fontSize: '13px', color: '#64748b' }}>
            Pay via direct deposit or cash as agreed. After you confirm payment, the worker can confirm receipt to close the invoice.
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default CustomerInvoiceView;
