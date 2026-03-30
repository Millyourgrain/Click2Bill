import React, { useEffect, useState } from 'react';
import { formatInvoiceMoney, DEFAULT_INVOICE_CURRENCY, isCadCurrency, formatCadSalesTaxLabel } from '../../utils/invoiceCurrency';
import { getInvoiceHeaderTemplate } from '../../utils/invoiceHeaderTemplates';
import { fetchStorageImageBlob } from '../../utils/storageImageProxy';

function formatVisitCheckTimes(visit) {
  if (!visit?.checkInTime || !visit?.checkOutTime) return null;
  const d1 = new Date(visit.checkInTime);
  const d2 = new Date(visit.checkOutTime);
  const dayDate = d1.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const t1 = d1.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
  const t2 = d2.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dayDate} • Check-in: ${t1} • Check-out: ${t2}`;
}

function formatInvoiceDateLong(isoYmd) {
  if (!isoYmd) return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const d = new Date(`${isoYmd}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? String(isoYmd)
    : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Renders the same visual structure as the issuer preview so html2canvas + PDF match.
 * `inv` is a Firestore invoice document (customer portal, worker detail, PDF capture).
 */
export default function StoredInvoicePreview({ inv, rootId = 'stored-invoice-preview', className = 'invoice-preview invoice-compact' }) {
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const headerKey = inv?.headerTemplate || 'professional';
  const template = getInvoiceHeaderTemplate(headerKey);
  const cur = inv?.currency || DEFAULT_INVOICE_CURRENCY;
  const payorDiff = !!inv?.isPayorDifferentFromCustomer;

  useEffect(() => {
    const url = (inv?.companyLogo || '').trim();
    if (!url) {
      setLogoDataUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const blob = await fetchStorageImageBlob(url);
        if (!blob) throw new Error('logo fetch failed');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (!cancelled) setLogoDataUrl(dataUrl);
      } catch (e) {
        console.warn('Stored invoice logo could not be inlined:', e);
        if (!cancelled) setLogoDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [inv?.companyLogo]);

  if (!inv) return null;

  const items = inv.items || [];
  const travelItems = inv.travelItems || [];
  const visits = inv.servicePeriodVisits || [];

  return (
    <div id={rootId} className={className}>
      <div
        style={{
          backgroundColor: template.bg,
          color: template.text,
          padding: '32px',
          borderRadius: '8px 8px 0 0',
          textAlign: 'center',
          marginBottom: '0',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '-1px' }}>
          INVOICE
        </h1>
        <div style={{ fontSize: '20px', fontWeight: '600', opacity: 0.9 }}>{inv.invoiceNumber}</div>
      </div>

      <div
        className="invoice-metadata-row"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          alignItems: 'baseline',
          gap: '12px 32px',
          padding: '16px 32px',
          marginBottom: '24px',
          borderBottom: '1px solid #e9ecef',
          fontSize: '14px',
          color: '#333',
        }}
      >
        <div><strong>Date:</strong> {inv.date}</div>
        {inv.dueDate && <div><strong>Due date:</strong> {inv.dueDate}</div>}
        <div style={{ marginLeft: 'auto' }}><strong>Currency:</strong> {cur}</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          marginBottom: '32px',
          padding: '0 32px',
          alignItems: 'start',
        }}
      >
        <div style={{ alignSelf: 'start' }}>
          {(logoDataUrl || inv.companyLogo) && (
            <img
              src={logoDataUrl || inv.companyLogo}
              alt=""
              crossOrigin="anonymous"
              className="invoice-preview-logo"
              style={{ maxWidth: '150px', maxHeight: '80px', marginBottom: '16px', display: 'block', objectFit: 'contain' }}
            />
          )}
          <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>
            {inv.legalBusinessName || inv.companyName}
          </div>
          {inv.operationalNameDba && (
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>DBA: {inv.operationalNameDba}</div>
          )}
          {inv.companyAddress && (
            <div style={{ fontSize: '14px', color: '#666', whiteSpace: 'pre-line', marginBottom: '4px' }}>
              {inv.companyAddress}
            </div>
          )}
          {inv.gstNumber && <div style={{ fontSize: '14px', color: '#666' }}>HST/GST No.: {inv.gstNumber}</div>}
          {inv.bnNumber && <div style={{ fontSize: '14px', color: '#666' }}>Business no. (BN): {inv.bnNumber}</div>}
        </div>

        <div style={{ textAlign: 'right', alignSelf: 'start' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.06em' }}>
            BILL TO
          </div>
          <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>{inv.customerName}</div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{inv.customerEmail}</div>
          {payorDiff && (inv.payorName || inv.payorEmail) && (
            <div style={{ fontSize: '13px', color: '#555', marginTop: '8px', padding: '8px', background: '#f8f9fa', borderRadius: '6px', textAlign: 'left' }}>
              <div style={{ fontWeight: '600', marginBottom: '2px' }}>Payor</div>
              {inv.payorName && <div>{inv.payorName}</div>}
              {inv.payorEmail && <div>{inv.payorEmail}</div>}
            </div>
          )}
          {inv.serviceAddress && (
            <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
              Service address:<br />
              {inv.serviceAddress}
            </div>
          )}
        </div>
      </div>

      {visits.length > 0 && (
        <div style={{ margin: '0 32px 16px', padding: '12px 16px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #1e3a5f', fontSize: '13px' }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>Service period</div>
          {visits.map((v, idx) => {
            const line = formatVisitCheckTimes(v);
            return line ? <div key={idx} style={{ marginBottom: idx < visits.length - 1 ? '6px' : 0 }}>{line}</div> : null;
          })}
        </div>
      )}

      <table className="items-table items-table-invoice" style={{ margin: '0 32px 24px', width: 'calc(100% - 64px)' }}>
        <thead>
          <tr>
            <th className="col-description">Description</th>
            <th className="text-right col-qty">Quantity</th>
            <th className="text-right col-rate">Rate</th>
            <th className="text-right col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="col-description">{item.description}</td>
              <td className="text-right col-qty">{item.quantity ?? 1}</td>
              <td className="text-right col-rate">{formatInvoiceMoney(item.rate ?? 0, cur)}</td>
              <td className="text-right item-amount col-amount">{formatInvoiceMoney(item.amount ?? 0, cur)}</td>
            </tr>
          ))}
          {travelItems.map((item, index) => (
            <tr key={`t-${index}`}>
              <td className="col-description">{item.description}</td>
              <td className="text-right col-qty">{item.quantity ?? 1}</td>
              <td className="text-right col-rate">
                {(item.rate ?? item.amount) != null ? formatInvoiceMoney(item.rate ?? item.amount, cur) : '–'}
              </td>
              <td className="text-right item-amount col-amount">{formatInvoiceMoney(item.amount ?? 0, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ padding: '0 32px' }} className="invoice-footer">
        <div className="footer-left">
          {inv.notes && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Notes</h3>
              <div style={{ fontSize: '13px', color: '#666' }}>{inv.notes}</div>
            </div>
          )}
        </div>
        <div className="totals-box">
          <div className="total-row">
            <span>Service charge (before tax):</span>
            <span className="total-value">{formatInvoiceMoney(inv.subtotal ?? 0, cur)}</span>
          </div>
          <div className="total-row">
            <span>{isCadCurrency(cur) ? `${formatCadSalesTaxLabel(inv.taxRate)}:` : 'Tax (manual):'}</span>
            <span className="total-value">{formatInvoiceMoney(inv.tax ?? 0, cur)}</span>
          </div>
          {travelItems.length > 0 && (
            <div className="total-row" style={{ backgroundColor: '#e8f5e9', padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid #4caf50' }}>
              <span style={{ fontSize: '14px', color: '#2e7d32' }}>Travel Costs:</span>
              <span className="total-value" style={{ color: '#2e7d32' }}>
                {formatInvoiceMoney(inv.travelTotal ?? 0, cur)}
              </span>
            </div>
          )}
          <div className="total-row grand-total">
            <span>Total:</span>
            <span>{formatInvoiceMoney(inv.total ?? 0, cur)}</span>
          </div>
        </div>
      </div>

      <div
        className="invoice-business-footer-band"
        style={{
          margin: '24px 32px 0',
          padding: '18px 20px',
          background: '#f4f6f8',
          borderTop: '2px solid #dee2e6',
          fontSize: '12px',
          color: '#495057',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '10px', color: '#212529', letterSpacing: '0.04em' }}>
          SUPPLIER / VENDOR DETAILS
        </div>
        <div style={{ fontWeight: '600', color: '#212529' }}>{inv.legalBusinessName || inv.companyName}</div>
        {inv.operationalNameDba && <div>DBA: {inv.operationalNameDba}</div>}
        {inv.companyAddress && <div style={{ whiteSpace: 'pre-line', marginTop: '4px' }}>{inv.companyAddress}</div>}
        <div style={{ marginTop: '8px' }}>
          {(inv.issuerPaymentEmail || inv.companyEmail) && <div>Email: {inv.issuerPaymentEmail || inv.companyEmail}</div>}
          {inv.gstNumber && <div>HST/GST registration no.: {inv.gstNumber}</div>}
        </div>
      </div>

      {inv.signature && (
        <div className="signature-section-footer" style={{ margin: '28px 32px 0' }}>
          <div className="signature-label">Authorized signature</div>
          <img src={inv.signature} alt="" className="signature-image" crossOrigin="anonymous" />
          <div className="signature-printed-lines" style={{ marginTop: '14px', fontSize: '13px', color: '#212529', lineHeight: 1.5 }}>
            {inv.signatoryPrintedName && <div style={{ fontWeight: '600' }}>{inv.signatoryPrintedName}</div>}
            {(inv.signatoryTitle || '').trim() && <div style={{ color: '#495057' }}>{inv.signatoryTitle.trim()}</div>}
            <div style={{ color: '#495057' }}>Date: {formatInvoiceDateLong(inv.date)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
