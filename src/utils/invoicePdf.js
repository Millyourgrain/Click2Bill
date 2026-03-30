import html2canvas from 'html2canvas';
import { formatInvoiceMoney, DEFAULT_INVOICE_CURRENCY, isCadCurrency, formatCadSalesTaxLabel } from './invoiceCurrency';
import { storageProxyFetchUrl } from './storageImageProxy';

function getJsPdf() {
  if (typeof window === 'undefined' || !window.jspdf?.jsPDF) return null;
  return window.jspdf.jsPDF;
}

function getPreviewElement(previewEl) {
  if (previewEl && previewEl instanceof HTMLElement) return previewEl;
  if (typeof document === 'undefined') return null;
  return document.getElementById('invoice-preview');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Swap remote <img src> to data URLs so html2canvas can paint logos and signatures. */
async function inlineImgSrcDataUrls(root) {
  if (!root?.querySelectorAll) return () => {};
  const imgs = [...root.querySelectorAll('img[src]')];
  const reverts = [];
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
      try {
        const proxy = storageProxyFetchUrl(src);
        const tryUrls = proxy ? [proxy, src] : [src];
        let blob = null;
        let lastStatus = '';
        for (const u of tryUrls) {
          const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
          if (res.ok) {
            blob = await res.blob();
            break;
          }
          lastStatus = String(res.status);
        }
        if (!blob) throw new Error(lastStatus || 'fetch');
        const dataUrl = await blobToDataUrl(blob);
        const prev = src;
        img.setAttribute('src', dataUrl);
        reverts.push(() => img.setAttribute('src', prev));
      } catch (e) {
        console.warn('invoicePdf: could not inline image for capture', src, e);
      }
    })
  );
  return () => {
    reverts.forEach((fn) => {
      try {
        fn();
      } catch (_) { /* ignore */ }
    });
  };
}

/**
 * Page 2: payment / banking (used after preview raster or text-only page 1).
 */
export function appendPaymentInstructionsPage(doc, invoice, companyInfo) {
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentW = pageWidth - 2 * margin;
  let py = margin;
  const flush = (text, { size = 11, bold = false, gap = 5 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text), contentW);
    doc.text(lines, margin, py);
    py += lines.length * (size * 0.48) + gap;
  };

  flush('Payment Instructions', { size: 16, bold: true, gap: 8 });
  flush('Please make payment within due date of the invoice using one of the following methods:', { gap: 8 });

  flush('Interac e-Transfer', { size: 12, bold: true, gap: 4 });
  if (companyInfo?.email) {
    flush(`Send payment to: ${companyInfo.email}`, { gap: 3 });
    flush('Auto-deposit enabled.', { gap: 10 });
  } else {
    flush('Interac e-Transfer email is not set on your business profile. Add it under Business profile.', { gap: 10 });
  }

  flush('Direct Bank Deposit (EFT)', { size: 12, bold: true, gap: 4 });
  const acctName = companyInfo?.legalBusinessName || companyInfo?.companyName || '—';
  const transit = companyInfo?.bankTransitNumber || '';
  const inst = companyInfo?.bankInstitutionNumber || '';
  const acct = companyInfo?.bankAccountNumber || '';
  flush(`Account Name: ${acctName}`, { gap: 3 });
  flush(`Transit Number: ${transit || '—'}`, { gap: 3 });
  flush(`Institution Number: ${inst || '—'}`, { gap: 3 });
  flush(`Account Number: ${acct || '—'}`, { gap: 10 });

  const invNum = invoice?.invoiceNumber || 'Invoice Number';
  flush(`Please include the ${invNum} in the payment reference.`, { gap: 6 });
}

/**
 * Page 1: rasterize the on-screen invoice preview (matches template).
 * Page 2: payment instructions from company profile.
 */
export async function buildInvoicePdfDocFromPreview({ previewEl, invoice, companyInfo, subtotal, tax, travelTotal, total }) {
  const jsPDF = getJsPdf();
  const el = getPreviewElement(previewEl);
  if (!jsPDF || !el) return null;

  const cur = invoice.currency || DEFAULT_INVOICE_CURRENCY;
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentW = pageWidth - 2 * margin;
  const contentH = pageHeight - 2 * margin;

  const rect = el.getBoundingClientRect();
  const scale = Math.min(2, Math.max(1.25, 992 / Math.max(rect.width || 1, 1)));

  const revertImages = await inlineImgSrcDataUrls(el);
  let canvas;
  try {
    canvas = await html2canvas(el, {
      scale,
      logging: false,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      width: el.scrollWidth,
      height: el.scrollHeight,
    });
  } catch (e) {
    console.warn('Preview rasterization failed; falling back to text PDF.', e);
    return null;
  } finally {
    revertImages();
  }

  let imgData;
  try {
    imgData = canvas.toDataURL('image/jpeg', 0.95);
  } catch (e) {
    console.warn('Could not export preview canvas (often cross-origin images); falling back to text PDF.', e);
    return null;
  }
  const imgWidth = contentW;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let y = margin;

  doc.addImage(imgData, 'JPEG', margin, y, imgWidth, imgHeight);
  heightLeft -= contentH;

  while (heightLeft > 0.5) {
    y = margin - (imgHeight - heightLeft);
    doc.addPage();
    doc.addImage(imgData, 'JPEG', margin, y, imgWidth, imgHeight);
    heightLeft -= contentH;
  }

  doc.addPage();
  appendPaymentInstructionsPage(doc, invoice, companyInfo);

  return doc;
}

/** Fallback text PDF if preview or libraries unavailable */
export function buildInvoicePdfDoc({ invoice, companyInfo, subtotal, tax, travelTotal, total }) {
  const jsPDF = getJsPdf();
  if (!jsPDF) return null;

  const doc = new jsPDF();
  const cur = invoice.currency || DEFAULT_INVOICE_CURRENCY;
  let y = 14;
  const pad = (label, val) => {
    doc.setFontSize(10);
    doc.text(String(label), 14, y);
    doc.text(String(val), 140, y);
    y += 6;
  };

  doc.setFontSize(16);
  doc.text('INVOICE', 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 14, y);
  y += 8;
  doc.text(`Date: ${invoice.date || '—'}`, 14, y);
  y += 6;
  doc.text(`Due: ${invoice.dueDate || '—'}`, 14, y);
  y += 6;
  doc.text(`Currency: ${cur}`, 14, y);
  y += 10;

  const from = companyInfo?.legalBusinessName || companyInfo?.companyName || '';
  if (from) {
    doc.setFontSize(10);
    doc.text('From:', 14, y);
    y += 6;
    doc.text(from, 14, y);
    y += 6;
  }

  doc.text(`Bill to: ${invoice.customerName || '—'}`, 14, y);
  y += 8;

  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 8;

  (invoice.items || []).forEach((item) => {
    const desc = (item.description || 'Line').slice(0, 72);
    pad(desc, formatInvoiceMoney(item.amount ?? 0, cur));
  });

  (invoice.travelItems || []).forEach((item) => {
    const desc = (item.description || 'Travel').slice(0, 72);
    pad(desc, formatInvoiceMoney(item.amount ?? 0, cur));
  });

  y += 4;
  doc.line(14, y, 196, y);
  y += 8;
  pad('Service charge (before tax)', formatInvoiceMoney(subtotal, cur));
  const taxLabel = isCadCurrency(cur) ? `${formatCadSalesTaxLabel(invoice.taxRate)}` : 'Tax (manual)';
  pad(taxLabel, formatInvoiceMoney(tax, cur));
  if ((travelTotal || 0) > 0) {
    pad('Travel', formatInvoiceMoney(travelTotal, cur));
  }
  doc.setFont('helvetica', 'bold');
  pad('Total', formatInvoiceMoney(total, cur));
  doc.setFont('helvetica', 'normal');

  if (invoice.notes) {
    y += 6;
    doc.setFontSize(9);
    const notes = doc.splitTextToSize(String(invoice.notes), 180);
    doc.text(notes, 14, y);
  }

  doc.addPage();
  appendPaymentInstructionsPage(doc, invoice, companyInfo);

  return doc;
}

export async function downloadInvoicePdf(props) {
  let doc = await buildInvoicePdfDocFromPreview(props);
  if (!doc) {
    doc = buildInvoicePdfDoc(props);
  }
  if (!doc) {
    window.print();
    return;
  }
  const num = props.invoice?.invoiceNumber || 'invoice';
  doc.save(`${num.replace(/[^\w.-]+/g, '_')}.pdf`);
}

export async function buildInvoicePdfBase64(props) {
  let doc = await buildInvoicePdfDocFromPreview(props);
  if (!doc) {
    doc = buildInvoicePdfDoc(props);
  }
  if (!doc) return '';
  const dataUri = doc.output('datauristring');
  const i = dataUri.indexOf(',');
  return i >= 0 ? dataUri.slice(i + 1) : '';
}

export function buildCompanyInfoFromInvoiceRecord(inv) {
  if (!inv) return {};
  return {
    companyName: inv.companyName || inv.legalBusinessName,
    legalBusinessName: inv.legalBusinessName || inv.companyName,
    operationalNameDba: inv.operationalNameDba || '',
    companyAddress: inv.companyAddress || '',
    logoUrl: inv.companyLogo || '',
    gstNumber: inv.gstNumber || '',
    email: inv.issuerPaymentEmail || inv.companyEmail || '',
    bnNumber: inv.bnNumber || '',
    bankTransitNumber: inv.bankTransitNumber || '',
    bankInstitutionNumber: inv.bankInstitutionNumber || '',
    bankAccountNumber: inv.bankAccountNumber || '',
  };
}

/**
 * Download PDF from a stored invoice document.
 * Pass the same preview root id as `StoredInvoicePreview` (`stored-invoice-preview` on customer view).
 */
export async function downloadStoredInvoicePdf(inv, options = {}) {
  const previewId = options.previewElId || 'stored-invoice-preview';
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, options.settleMs ?? 180));
    });
  });
  const el =
    options.previewEl ||
    (typeof document !== 'undefined' ? document.getElementById(previewId) : null);
  const companyInfo = buildCompanyInfoFromInvoiceRecord(inv);
  const invoice = {
    invoiceNumber: inv.invoiceNumber,
    date: inv.date,
    dueDate: inv.dueDate,
    customerName: inv.customerName,
    items: inv.items || [],
    travelItems: inv.travelItems || [],
    currency: inv.currency,
    taxRate: inv.taxRate,
    notes: inv.notes,
    manualTaxAmount: inv.manualTaxAmount,
  };
  await downloadInvoicePdf({
    invoice,
    companyInfo,
    subtotal: inv.subtotal ?? 0,
    tax: inv.tax ?? 0,
    travelTotal: inv.travelTotal ?? 0,
    total: inv.total ?? 0,
    previewEl: el || null,
  });
}

export function buildInvoiceSummaryHtml({ invoice, companyInfo, subtotal, tax, travelTotal, total, invoiceLink, linkOnly }) {
  const cur = invoice.currency || DEFAULT_INVOICE_CURRENCY;
  const from = companyInfo?.legalBusinessName || companyInfo?.companyName || 'Your supplier';
  const rows = (invoice.items || [])
    .map((item) => `<tr><td>${escapeHtml(item.description || '')}</td><td style="text-align:right">${formatInvoiceMoney(item.amount ?? 0, cur)}</td></tr>`)
    .join('');
  const travelRows = (invoice.travelItems || [])
    .map((item) => `<tr><td>${escapeHtml(item.description || '')}</td><td style="text-align:right">${formatInvoiceMoney(item.amount ?? 0, cur)}</td></tr>`)
    .join('');
  const taxLabel = isCadCurrency(cur) ? formatCadSalesTaxLabel(invoice.taxRate) : 'Tax (manual)';
  const footer = linkOnly
    ? `<p style="font-family:sans-serif;font-size:13px;color:#444"><strong>Next step:</strong> use the button or link above to open your invoice. You can <strong>accept</strong> the charges and download a PDF copy, or <strong>contest</strong> the invoice and leave a comment for ${escapeHtml(from)}.</p>`
    : `<p style="font-family:sans-serif;font-size:13px;color:#444">A PDF copy is attached for your records.</p>`;
  return `
    <p>Dear ${escapeHtml(invoice.customerName || 'customer')},</p>
    <p>An invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is ready from <strong>${escapeHtml(from)}</strong>.</p>
    ${invoiceLink ? `<p style="font-family:sans-serif;font-size:15px"><a href="${invoiceLink}" style="display:inline-block;padding:12px 20px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open invoice</a></p><p style="font-family:sans-serif;font-size:13px;color:#555">Or copy this link: <a href="${invoiceLink}">${invoiceLink}</a></p>` : ''}
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <thead><tr><th align="left">Description</th><th align="right">Amount</th></tr></thead>
      <tbody>${rows}${travelRows}</tbody>
    </table>
    <p style="font-family:sans-serif;font-size:14px">
      Service charge: <strong>${formatInvoiceMoney(subtotal, cur)}</strong><br/>
      ${taxLabel}: <strong>${formatInvoiceMoney(tax, cur)}</strong><br/>
      ${(travelTotal || 0) > 0 ? `Travel: <strong>${formatInvoiceMoney(travelTotal, cur)}</strong><br/>` : ''}
      <strong>Total: ${formatInvoiceMoney(total, cur)}</strong>
    </p>
    ${footer}
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
