/**
 * accountingExport.js
 * ───────────────────────────────────────────────────────────────────────────
 * Transforms Click2Bill invoice data into accounting-platform-ready CSVs.
 *
 * Supported targets
 *   • "platform"  – internal flat export (one row per invoice)
 *   • "xero"      – Xero invoice import CSV (YYYY-MM-DD dates, one row / line item)
 *   • "qbo"       – QuickBooks Online invoice import CSV (MM/DD/YYYY dates)
 *
 * IMPORTANT — taxRate storage convention
 *   taxRate is stored as a WHOLE-NUMBER PERCENTAGE (e.g. 13 means 13% HST).
 *   All calculations here divide by 100 where a fraction is needed.
 */

// ─── helpers ────────────────────────────────────────────────────────────────

/** Escape a single cell value for CSV RFC 4180. */
function esc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/** Serialise an array of row-objects to a RFC 4180 CSV string. */
function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.map(esc).join(','),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(',')),
  ].join('\r\n');
}

/**
 * Reformat a date string to the target format.
 * @param {string} raw  – "YYYY-MM-DD" or full ISO timestamp
 * @param {'iso'|'us'} fmt  – 'iso' = YYYY-MM-DD  |  'us' = MM/DD/YYYY
 */
function fmtDate(raw, fmt = 'iso') {
  if (!raw) return '';
  const d = String(raw).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (fmt === 'us') {
    const [y, m, day] = d.split('-');
    return `${m}/${day}/${y}`;
  }
  return d;
}

/** Format a number to 2 decimal places. */
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

/** today as YYYY-MM-DD */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derive payment terms label from invoice date and due date.
 * taxRate is a whole-number percentage stored in the DB.
 *
 * Returns "Net 30", "Net 60", etc. or "Due on receipt" if same day.
 */
function calcTerms(invoiceDate, dueDate) {
  if (!invoiceDate || !dueDate) return 'Net 30';
  const invMs = new Date(invoiceDate).getTime();
  const dueMs = new Date(dueDate).getTime();
  const days = Math.round((dueMs - invMs) / (1000 * 60 * 60 * 24));
  if (days <= 0)  return 'Due on receipt';
  if (days <= 10) return 'Net 10';
  if (days <= 15) return 'Net 15';
  if (days <= 30) return 'Net 30';
  if (days <= 45) return 'Net 45';
  if (days <= 60) return 'Net 60';
  if (days <= 90) return 'Net 90';
  return `Net ${days}`;
}

/** Xero invoice status from internal status */
function xeroStatus(status) {
  const map = {
    sent: 'AUTHORISED',
    viewed: 'AUTHORISED',
    accepted: 'AUTHORISED',
    contested: 'AUTHORISED',
    overdue: 'AUTHORISED',
    paid: 'PAID',
    cancelled: 'VOIDED',
  };
  return map[status] || 'AUTHORISED';
}

/** Xero tax type for Canadian GST/HST; EXEMPTOUTPUT for tax-exempt lines. */
function xeroTaxType(isTaxExempt) {
  return isTaxExempt ? 'EXEMPTOUTPUT' : 'GST/HST on Income';
}

/** QuickBooks tax code: "TAX" or "NON" */
function qboTaxCode(isTaxExempt) {
  return isTaxExempt ? 'NON' : 'TAX';
}

/**
 * Filter invoices appropriate for accounting system export.
 * Excludes:
 *  - status = 'draft'              (internal working copies)
 *  - approvalState = 'returned_to_maker' (not yet ready for external systems)
 * Returns only issued/active invoices.
 */
function filterExportable(invoices) {
  return invoices.filter(
    (inv) =>
      inv.status !== 'draft' &&
      inv.approvalState !== 'returned_to_maker',
  );
}

// ─── Platform CSV ────────────────────────────────────────────────────────────

function buildPlatformCsv(invoices) {
  // Platform export includes all invoices including drafts (full operational view)
  const rows = invoices.map((inv) => ({
    InvoiceNumber: inv.invoiceNumber ?? '',
    Date: inv.date ?? '',
    DueDate: inv.dueDate ?? '',
    CustomerName: inv.customerName ?? '',
    CustomerEmail: inv.customerEmail ?? '',
    Currency: inv.currency ?? 'CAD',
    Subtotal: num(inv.subtotal),
    Tax: num(inv.tax),
    TravelTotal: num(inv.travelTotal),
    Total: num(inv.total),
    Status: inv.status ?? '',
    ApprovalState: inv.approvalState ?? '',
    IssuedAt: inv.issuedAt ?? '',
    PaidAt: inv.paidAt ?? '',
    Notes: inv.notes ?? '',
  }));
  return { csv: rowsToCsv(rows), filename: `invoice-history-${today()}.csv`, warnings: [] };
}

// ─── Xero invoice import CSV ─────────────────────────────────────────────────
/**
 * One row per line item. Required columns:
 *   ContactName, InvoiceNumber, InvoiceDate, DueDate,
 *   Description, Quantity, UnitAmount, AccountCode, TaxType
 *
 * AccountCode defaults: 200 = Sales / Revenue, 489 = Travel Expenses.
 * TaxAmount is calculated per service line as UnitAmount × (taxRate / 100).
 * Travel lines are tax-exempt (TaxAmount = 0.00).
 *
 * Draft and returned-to-maker invoices are excluded.
 */
function buildXeroCsv(invoices) {
  const warnings = [];
  const rows = [];

  const exportable = filterExportable(invoices);
  const excluded = invoices.length - exportable.length;
  if (excluded > 0) {
    warnings.push(
      `${excluded} draft/in-progress invoice(s) excluded — only issued invoices are exported to Xero.`,
    );
  }

  for (const inv of exportable) {
    const header = {
      ContactName: inv.customerName || '(Unknown Customer)',
      EmailAddress: inv.customerEmail || '',
      InvoiceNumber: inv.invoiceNumber || '',
      Reference: '',
      InvoiceDate: fmtDate(inv.date, 'iso'),
      DueDate: fmtDate(inv.dueDate, 'iso'),
    };

    const currency = inv.currency || 'CAD';
    // taxRate is stored as a whole-number percentage (e.g. 13 for 13% HST)
    const taxRatePct = parseFloat(inv.taxRate) || 0; // e.g. 13
    const taxRateFrac = taxRatePct / 100;             // e.g. 0.13

    const serviceItems = Array.isArray(inv.items) ? inv.items : [];
    const travelItems  = Array.isArray(inv.travelItems) ? inv.travelItems : [];

    for (const item of serviceItems) {
      const qty  = parseFloat(item.quantity) || 1;
      const rate = parseFloat(item.rate) || 0;
      const lineAmt = qty * rate;
      // Calculate per-line tax amount based on item subtotal
      const lineTaxAmt = taxRatePct > 0 ? lineAmt * taxRateFrac : 0;

      rows.push({
        ...header,
        Description: item.description || 'Service',
        Quantity: num(qty),
        UnitAmount: num(rate),
        AccountCode: '200',
        TaxType: xeroTaxType(false),
        TaxAmount: num(lineTaxAmt),   // ← populated; was blank before
        CurrencyCode: currency,
        Status: xeroStatus(inv.status),
      });
    }

    for (const item of travelItems) {
      const travelAmt = parseFloat(item.rate ?? item.amount) || 0;
      const travelTax = taxRatePct > 0 ? travelAmt * taxRateFrac : 0;
      rows.push({
        ...header,
        Description: item.description || 'Travel expense',
        Quantity: '1',
        UnitAmount: num(travelAmt),
        AccountCode: '489',
        TaxType: xeroTaxType(false),   // taxable — same rate as services
        TaxAmount: num(travelTax),
        CurrencyCode: currency,
        Status: xeroStatus(inv.status),
      });
    }

    // Fallback: no line items — use invoice totals as single row
    if (serviceItems.length === 0 && travelItems.length === 0) {
      warnings.push(
        `Invoice ${inv.invoiceNumber}: no line items — exported as single summary row.`,
      );
      const subtotal = parseFloat(inv.subtotal) || parseFloat(inv.total) || 0;
      const taxAmt   = parseFloat(inv.tax) || 0;
      rows.push({
        ...header,
        Description: `Invoice ${inv.invoiceNumber}`,
        Quantity: '1',
        UnitAmount: num(subtotal),
        AccountCode: '200',
        TaxType: taxAmt > 0 ? xeroTaxType(false) : xeroTaxType(true),
        TaxAmount: num(taxAmt),
        CurrencyCode: currency,
        Status: xeroStatus(inv.status),
      });
    }
  }

  if (!rows.length) warnings.push('No exportable invoices found.');

  warnings.push(
    'AccountCode 200 = Sales/Revenue, 489 = Travel — verify against your Xero Chart of Accounts before importing.',
    'TaxType "GST/HST on Income" must match your Xero organisation\'s tax rate name exactly.',
  );

  return { csv: rowsToCsv(rows), filename: `xero-import-${today()}.csv`, warnings };
}

// ─── QuickBooks Online invoice import CSV ────────────────────────────────────
/**
 * One row per line item + a separate GST/HST summary row per invoice.
 * Required QBO columns: Invoice No, Customer, Invoice Date, Due Date, Item Amount.
 *
 * Terms are derived from dueDate − invoiceDate (Net 30, Net 60, etc.).
 *
 * Tax display: taxRate is stored as a whole-number percentage (13 = 13% HST).
 * The description row shows "GST/HST (13%)" — NOT "1300%" as before.
 *
 * Draft and returned-to-maker invoices are excluded.
 */
function buildQboCsv(invoices) {
  const warnings = [];
  const rows = [];

  const exportable = filterExportable(invoices);
  const excluded = invoices.length - exportable.length;
  if (excluded > 0) {
    warnings.push(
      `${excluded} draft/in-progress invoice(s) excluded — only issued invoices are exported to QuickBooks.`,
    );
  }

  for (const inv of exportable) {
    const invoiceNo = inv.invoiceNumber || '';
    const customer  = inv.customerName || '(Unknown Customer)';
    const invDate   = fmtDate(inv.date, 'us');
    const dueDate   = fmtDate(inv.dueDate, 'us') || invDate;
    const currency  = inv.currency || 'CAD';
    const memo      = inv.notes ? String(inv.notes).slice(0, 500) : '';
    // Derive terms from actual date difference
    const terms     = calcTerms(inv.date, inv.dueDate);
    // taxRate stored as whole-number % (e.g. 13)
    const taxRatePct = parseFloat(inv.taxRate) || 0;

    const serviceItems = Array.isArray(inv.items) ? inv.items : [];
    const travelItems  = Array.isArray(inv.travelItems) ? inv.travelItems : [];

    for (const item of serviceItems) {
      const qty  = parseFloat(item.quantity) || 1;
      const rate = parseFloat(item.rate) || 0;
      rows.push({
        'Invoice No': invoiceNo,
        Customer: customer,
        'Invoice Date': invDate,
        'Due Date': dueDate,
        Terms: terms,
        Memo: memo,
        'Item(Product/Service)': 'Services',
        'Item Description': item.description || 'Professional services',
        'Item Quantity': num(qty),
        'Item Rate': num(rate),
        'Item Amount': num(qty * rate),
        'Item Tax Code': qboTaxCode(false),
        Currency: currency,
      });
    }

    for (const item of travelItems) {
      rows.push({
        'Invoice No': invoiceNo,
        Customer: customer,
        'Invoice Date': invDate,
        'Due Date': dueDate,
        Terms: terms,
        Memo: memo,
        'Item(Product/Service)': 'Travel Expense',
        'Item Description': item.description || 'Travel expense',
        'Item Quantity': '1',
        'Item Rate': num(item.rate ?? item.amount),
        'Item Amount': num(item.amount ?? item.rate),
        'Item Tax Code': qboTaxCode(false),   // taxable — same rate as services
        Currency: currency,
      });
    }

    // Fallback: no line items
    if (serviceItems.length === 0 && travelItems.length === 0) {
      warnings.push(
        `Invoice ${inv.invoiceNumber}: no line items — exported as single summary row.`,
      );
      rows.push({
        'Invoice No': invoiceNo,
        Customer: customer,
        'Invoice Date': invDate,
        'Due Date': dueDate,
        Terms: terms,
        Memo: memo,
        'Item(Product/Service)': 'Services',
        'Item Description': `Invoice ${invoiceNo}`,
        'Item Quantity': '1',
        'Item Rate': num(inv.total),
        'Item Amount': num(inv.total),
        'Item Tax Code': 'NON',
        Currency: currency,
      });
    }

    // GST/HST summary row — taxRatePct is the whole-number % (e.g. 13, not 0.13)
    const taxAmt = parseFloat(inv.tax) || 0;
    if (taxAmt > 0) {
      rows.push({
        'Invoice No': invoiceNo,
        Customer: customer,
        'Invoice Date': invDate,
        'Due Date': dueDate,
        Terms: terms,
        Memo: '',
        'Item(Product/Service)': 'GST/HST',
        // ← FIX: was (taxRatePct * 100) which gave 1300% — now just taxRatePct (e.g. 13%)
        'Item Description': `GST/HST (${taxRatePct}%)`,
        'Item Quantity': '1',
        'Item Rate': num(taxAmt),
        'Item Amount': num(taxAmt),
        'Item Tax Code': 'NON',
        Currency: currency,
      });
    }
  }

  if (!rows.length) warnings.push('No exportable invoices found.');

  warnings.push(
    'QBO native CSV import does not apply sales tax automatically — verify tax after import or use QBO Automated Sales Tax.',
    'Customer names must exactly match existing QBO customer records (case-sensitive).',
    '"Services" and "Travel Expense" must exist in your QBO Products & Services list before importing.',
  );

  return { csv: rowsToCsv(rows), filename: `quickbooks-import-${today()}.csv`, warnings };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build an accounting-platform CSV from an array of invoice objects.
 *
 * @param {object[]} invoices  – array of invoice documents from Firestore
 * @param {'platform'|'xero'|'qbo'} target
 * @returns {{ csv: string, filename: string, warnings: string[] }}
 */
export function buildAccountingCsv(invoices, target = 'platform') {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { csv: '', filename: `export-${today()}.csv`, warnings: ['No invoice data provided.'] };
  }
  switch (target) {
    case 'xero':   return buildXeroCsv(invoices);
    case 'qbo':    return buildQboCsv(invoices);
    default:       return buildPlatformCsv(invoices);
  }
}

/**
 * Trigger a browser file-download for the given CSV string.
 * Includes UTF-8 BOM so Excel opens the file correctly.
 */
export function downloadCsvFile(csv, filename) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
