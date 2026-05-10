import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultDueDateFromInvoiceDate } from '../../utils/invoiceDates';
import './MarketingLanding.css';

function formatShortDate(iso) {
  if (!iso || !String(iso).trim()) return '—';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function lineAmount(q, r) {
  const qty = parseFloat(q);
  const rate = parseFloat(r);
  const qq = Number.isFinite(qty) && qty >= 0 ? qty : 1;
  const rr = Number.isFinite(rate) && rate >= 0 ? rate : 0;
  return qq * rr;
}

/** Same keys/colors as InvoiceGenerator header templates */
const HEADER_TEMPLATES = {
  classic: {
    name: 'Classic White',
    bg: '#ffffff',
    text: '#1a1a1a',
    border: '#1a1a1a',
    palette: '⚪',
  },
  professional: {
    name: 'Professional Navy',
    bg: '#1e3a5f',
    text: '#ffffff',
    border: '#1e3a5f',
    palette: '🔵',
  },
  modern: {
    name: 'Modern Teal',
    bg: '#008b8b',
    text: '#ffffff',
    border: '#008b8b',
    palette: '🟢',
  },
  elegant: {
    name: 'Elegant Purple',
    bg: '#6a1b9a',
    text: '#ffffff',
    border: '#6a1b9a',
    palette: '🟣',
  },
  corporate: {
    name: 'Corporate Gray',
    bg: '#424242',
    text: '#ffffff',
    border: '#424242',
    palette: '⚫',
  },
  fresh: {
    name: 'Fresh Green',
    bg: '#2e7d32',
    text: '#ffffff',
    border: '#2e7d32',
    palette: '🟢',
  },
};

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return [30, 58, 95];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function hexToRgbText(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return [255, 255, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export default function MarketingLanding() {
  const navigate = useNavigate();
  const createRef = useRef(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [operationalNameDba, setOperationalNameDba] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now()}`);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [serviceEndDate, setServiceEndDate] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [payorName, setPayorName] = useState('');
  const [payorEmail, setPayorEmail] = useState('');

  const [items, setItems] = useState([{ description: '', quantity: '1', rate: '' }]);
  const [taxRate, setTaxRate] = useState('13');
  const [travelRows, setTravelRows] = useState([]);
  const [notes, setNotes] = useState('');
  const [headerTemplate, setHeaderTemplate] = useState('professional');

  const currentTemplate = HEADER_TEMPLATES[headerTemplate] || HEADER_TEMPLATES.professional;

  const scrollToCreate = () => createRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.ml-reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const dueDateInitialized = useRef(false);
  useEffect(() => {
    if (dueDateInitialized.current) return;
    dueDateInitialized.current = true;
    const today = new Date().toISOString().split('T')[0];
    setDueDate(defaultDueDateFromInvoiceDate(today));
  }, []);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + lineAmount(it.quantity, it.rate), 0);
  }, [items]);

  const taxPct = parseFloat(taxRate);

  const travelTotal = useMemo(() => {
    return travelRows.reduce((sum, t) => {
      const a = parseFloat(t.amount);
      return sum + (Number.isFinite(a) && a > 0 ? a : 0);
    }, 0);
  }, [travelRows]);

  // Travel expenses are now subject to the same tax rate as services
  const taxAmount = (subtotal + travelTotal) * ((Number.isFinite(taxPct) ? taxPct : 0) / 100);
  const grandTotal = subtotal + travelTotal + taxAmount;

  const showPayorBlock = useMemo(() => {
    const pn = payorName?.trim();
    const pe = payorEmail?.trim();
    return (
      (pn && pn !== customerName.trim()) ||
      (pe && pe !== customerEmail.trim())
    );
  }, [payorName, payorEmail, customerName, customerEmail]);

  const previewCompanyLine = companyName.trim() || 'Your company';

  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const addItem = () => setItems((prev) => [...prev, { description: '', quantity: '1', rate: '' }]);
  const removeItem = (index) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addTravelRow = () => setTravelRows((prev) => [...prev, { description: '', amount: '' }]);
  const removeTravelRow = (index) => setTravelRows((prev) => prev.filter((_, i) => i !== index));
  const updateTravel = (index, field, value) => {
    setTravelRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const validItems = items.filter((it) => it.description?.trim() || parseFloat(it.rate) > 0);

  const alignRight = { align: 'right' };
  const alignCenter = { align: 'center' };

  const downloadPDF = async () => {
    if (!window.jspdf?.jsPDF) {
      alert('PDF library failed to load. Check your connection and try again.');
      return;
    }
    setPdfBusy(true);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210;
      const P = 20;
      const tpl = currentTemplate;
      const headerBg = hexToRgb(tpl.bg);
      const headerFg = hexToRgbText(tpl.text);
      const DK = [42, 31, 20];
      const MT = [138, 115, 96];
      const CR = [237, 227, 211];
      const TOT_BG = [248, 249, 250];

      const co = previewCompanyLine;
      const cu = customerName.trim() || 'Customer';
      const num = invoiceNumber.trim() || 'INV-001';
      const idate = formatShortDate(invoiceDate);
      const ddate = formatShortDate(dueDate);

      doc.setFillColor(...headerBg);
      doc.rect(0, 0, W, 30, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...headerFg);
      doc.text('Click2Bill', P, 19);
      doc.setFontSize(9);
      const headerSubRgb =
        tpl.bg.toLowerCase() === '#ffffff'
          ? [108, 117, 125]
          : [
              Math.min(255, Math.round(headerFg[0] * 0.88 + 28)),
              Math.min(255, Math.round(headerFg[1] * 0.88 + 28)),
              Math.min(255, Math.round(headerFg[2] * 0.88 + 28)),
            ];
      doc.setTextColor(...headerSubRgb);
      doc.text('INVOICE', W - P, 19, alignRight);

      let y = 44;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...MT);
      doc.text('FROM', P, y);
      doc.text('BILL TO', W / 2, y);
      y += 5;
      doc.setFontSize(10);
      doc.setTextColor(...DK);
      doc.text(co, P, y);
      doc.text(cu, W / 2, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MT);
      if (operationalNameDba.trim()) {
        doc.text(`DBA: ${operationalNameDba.trim()}`, P, y);
        y += 4.5;
      }
      if (companyAddress.trim()) {
        doc.text(companyAddress.trim(), P, y);
        y += 4.5;
      }
      if (gstNumber.trim()) {
        doc.text(`HST/GST: ${gstNumber.trim()}`, P, y);
        y += 4.5;
      }
      let yRight = 49;
      if (customerEmail.trim()) {
        doc.text(customerEmail.trim(), W / 2, yRight);
        yRight += 4.5;
      }
      if (showPayorBlock) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('Payor', W / 2, yRight);
        yRight += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        if (payorName.trim()) {
          doc.text(payorName.trim(), W / 2, yRight);
          yRight += 4.5;
        }
        if (payorEmail.trim()) {
          doc.text(payorEmail.trim(), W / 2, yRight);
          yRight += 4.5;
        }
      }
      if (serviceAddress.trim()) {
        doc.text(`Service: ${serviceAddress.trim()}`, W / 2, yRight);
        yRight += 4.5;
      }

      y = Math.max(y, yRight) + 6;

      if (serviceStartDate && serviceEndDate) {
        doc.setFontSize(8);
        doc.setTextColor(...DK);
        doc.text(`Service period: ${serviceStartDate} → ${serviceEndDate}`, P, y);
        y += 6;
      }

      const mx = W - P - 58;
      doc.setFillColor(...CR);
      doc.roundedRect(mx, 36, 58, 36, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...MT);
      doc.text('INVOICE NO.', mx + 4, 44);
      doc.text('DATE', mx + 4, 54);
      doc.text('DUE DATE', mx + 4, 64);
      doc.setFontSize(9);
      doc.setTextColor(...DK);
      doc.text(num, mx + 4, 49);
      doc.text(idate, mx + 4, 59);
      doc.text(ddate, mx + 4, 69);

      y = 88;
      doc.setDrawColor(...CR);
      doc.setLineWidth(0.5);
      doc.line(P, y, W - P, y);

      y += 8;
      doc.setFillColor(...CR);
      doc.rect(P, y - 5, W - P * 2, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...MT);
      doc.text('DESCRIPTION', P + 3, y + 1);
      doc.text('QTY', W - 95, y + 1, alignRight);
      doc.text('RATE', W - 57, y + 1, alignRight);
      doc.text('AMOUNT', W - P - 2, y + 1, alignRight);

      y += 10;
      const drawRow = (desc, qty, rateStr, amtStr, alt) => {
        if (alt) {
          doc.setFillColor(252, 249, 244);
          doc.rect(P, y - 5, W - P * 2, 9, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...DK);
        doc.text(desc || '—', P + 3, y);
        doc.setTextColor(...MT);
        doc.text(String(qty), W - 95, y, alignRight);
        doc.text(rateStr, W - 57, y, alignRight);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DK);
        doc.text(amtStr, W - P - 2, y, alignRight);
        y += 10;
      };

      validItems.forEach((it, idx) => {
        const q = parseFloat(it.quantity);
        const qq = Number.isFinite(q) && q >= 0 ? q : 1;
        const rt = parseFloat(it.rate);
        const rr = Number.isFinite(rt) ? rt : 0;
        const amt = qq * rr;
        drawRow(
          it.description || '—',
          qq,
          `$${rr.toFixed(2)}`,
          `$${amt.toFixed(2)}`,
          idx % 2 === 1
        );
      });

      travelRows.forEach((t, idx) => {
        const a = parseFloat(t.amount);
        const amt = Number.isFinite(a) ? a : 0;
        if (!t.description?.trim() && amt <= 0) return;
        drawRow(t.description || 'Travel', 1, `$${amt.toFixed(2)}`, `$${amt.toFixed(2)}`, (validItems.length + idx) % 2 === 1);
      });

      y += 4;
      doc.setFillColor(...TOT_BG);
      doc.setDrawColor(222, 226, 230);
      doc.roundedRect(W - P - 75, y, 78, 36, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...MT);
      doc.text('SERVICES', W - P - 72, y + 7);
      doc.text('TRAVEL', W - P - 72, y + 14);
      doc.text(`TAX (${Number.isFinite(taxPct) ? taxPct : 0}%)`, W - P - 72, y + 21);
      doc.text('TOTAL', W - P - 72, y + 30);
      doc.setFontSize(9);
      doc.setTextColor(...DK);
      doc.text(`$${subtotal.toFixed(2)}`, W - P - 4, y + 7, alignRight);
      doc.text(`$${travelTotal.toFixed(2)}`, W - P - 4, y + 14, alignRight);
      doc.text(`$${taxAmount.toFixed(2)}`, W - P - 4, y + 21, alignRight);
      doc.setFontSize(12);
      doc.setTextColor(...DK);
      doc.text(`$${grandTotal.toFixed(2)}`, W - P - 4, y + 30, alignRight);

      if (notes.trim()) {
        y += 44;
        doc.setDrawColor(...CR);
        doc.line(P, y, W - P, y);
        y += 7;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...MT);
        doc.text(doc.splitTextToSize(notes.trim(), W - P * 2), P, y);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(200, 185, 168);
      doc.text('Generated with Click2Bill — same fields as the full app invoice.', W / 2, 286, alignCenter);

      doc.save(`${num.replace(/[^\w.-]+/g, '_')}-click2bill.pdf`);
    } catch (e) {
      console.error(e);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="marketing-landing">
      <nav className={`ml-nav${navScrolled ? ' scrolled' : ''}`} aria-label="Main">
        <div className="ml-nav-start">
          <button type="button" className="ml-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Click<span>2</span>Bill
          </button>
        </div>
        <ul className="ml-nav-links">
          <li>
            <a href="#create" onClick={(e) => { e.preventDefault(); scrollToCreate(); }}>Free invoice</a>
          </li>
          <li>
            <a href="#features">Features</a>
          </li>
          <li>
            <a href="#how">How it works</a>
          </li>
          <li>
            <a href="#about">About us</a>
          </li>
        </ul>
        <div className="ml-nav-end">
          <div className="ml-nav-auth-tabs" role="group" aria-label="Sign up or sign in">
            <button type="button" className="ml-nav-tab" onClick={() => navigate('/register')}>
              Sign up
            </button>
            <button type="button" className="ml-nav-tab" onClick={() => navigate('/login')}>
              Access to portal
            </button>
          </div>
        </div>
      </nav>

      <section className="ml-hero" id="home">
        <div className="ml-hero-content">
          <div className="ml-hero-badge">Full scale e-billing platform for service businesses</div>
          <h1 className="ml-hero-title">
            Billing that mirrors
            <br />
            your <em>real workflow.</em>
          </h1>
          <p className="ml-hero-sub">
            Try the same invoice structure as the app — company details, customer &amp; payor, service period, line items,
            travel (optional), HST and notes. Download a PDF free, or register to save and send.
          </p>
          <div className="ml-hero-actions">
            <button type="button" className="ml-btn-hero" onClick={scrollToCreate}>
              Build a free PDF invoice →
            </button>
            <button type="button" className="ml-btn-hero-outline" onClick={() => navigate('/login')}>
              Access to Portal
            </button>
          </div>
          <div className="ml-hero-trust">
            <div className="ml-trust-avatars">
              <span className="ml-av1">C</span>
              <span className="ml-av2">2</span>
              <span className="ml-av3">B</span>
            </div>
            <span>
              Line items, travel, and tax totals match <strong>InvoiceGenerator</strong> in the app
            </span>
          </div>
        </div>

        <div className="ml-hero-visual">
          <div className="ml-float-card fc1">
            <div className="ml-fc-icon">📄</div>
            <div className="ml-fc-val">HST {taxRate || '13'}%</div>
            <div className="ml-fc-lbl">On services only</div>
          </div>
          <div className="ml-invoice-card">
            <div className="ml-inv-header">
              <div className="ml-inv-logo">
                Click<span>2</span>Bill
              </div>
              <span className="ml-inv-badge">PREVIEW</span>
            </div>
            <div className="ml-inv-meta">
              <div className="ml-inv-field">
                <label>Invoice no.</label>
                <p>{invoiceNumber || 'INV-…'}</p>
              </div>
              <div className="ml-inv-field">
                <label>Due date</label>
                <p>{formatShortDate(dueDate)}</p>
              </div>
              <div className="ml-inv-field">
                <label>Bill to</label>
                <p>{customerName.trim() || 'Customer name'}</p>
              </div>
              <div className="ml-inv-field">
                <label>From</label>
                <p>{previewCompanyLine}</p>
              </div>
            </div>
            <div className="ml-inv-items">
              {(validItems.length ? validItems : [{ description: 'Line items from builder', quantity: '1', rate: '0' }]).slice(0, 3).map((it, i) => (
                <div key={i} className="ml-inv-item">
                  <div>
                    <div className="ml-item-name">{it.description || 'Description'}</div>
                    <div className="ml-item-desc">
                      Qty {it.quantity || 1} × ${parseFloat(it.rate || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="ml-item-amt">${lineAmount(it.quantity, it.rate).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="ml-inv-total">
              <div className="ml-total-label">Total (incl. tax &amp; travel)</div>
              <div className="ml-total-amt">${grandTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="ml-float-card fc2">
            <div className="ml-fc-icon">🚗</div>
            <div className="ml-fc-val">${travelTotal.toFixed(0)}</div>
            <div className="ml-fc-lbl">Travel (tax-exempt)</div>
          </div>
        </div>
      </section>

      <section className="ml-builder-section" id="create" ref={createRef}>
        <div className="ml-builder-header">
          <span className="ml-stag">Free invoice builder</span>
          <h2>
            Same fields as the app invoice.
            <br />
            <em>PDF in one click.</em>
          </h2>
          <p>
            Headers match <strong>InvoiceGenerator</strong>: company block, invoice number &amp; dates, service period, customer &amp;
            payor, service address, description / quantity / rate / amount, optional travel lines, tax, and notes.
          </p>
        </div>

        <div className="ml-builder-wrap">
          <div className="ml-builder-form">
            <div className="ml-fsec">Your company</div>
            <div className="ml-frow">
              <div className="ml-field">
                <label>Company / legal business name</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Services Inc." />
              </div>
              <div className="ml-field">
                <label>Operational name (DBA)</label>
                <input value={operationalNameDba} onChange={(e) => setOperationalNameDba(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="ml-field">
              <label>Company address</label>
              <textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Street, city, province, postal code" />
            </div>
            <div className="ml-field">
              <label>HST / GST number</label>
              <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="e.g. 123456789 RT0001" />
            </div>

            <div className="ml-fsec">Invoice information</div>
            <div className="ml-frow tri">
              <div className="ml-field">
                <label>Invoice number</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="ml-field">
                <label>Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="ml-field">
                <label>Due date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="ml-fsec">Service period (optional)</div>
            <div className="ml-frow">
              <div className="ml-field">
                <label>Service start</label>
                <input type="date" value={serviceStartDate} onChange={(e) => setServiceStartDate(e.target.value)} />
              </div>
              <div className="ml-field">
                <label>Service end</label>
                <input type="date" value={serviceEndDate} onChange={(e) => setServiceEndDate(e.target.value)} />
              </div>
            </div>

            <div className="ml-fsec">Customer</div>
            <div className="ml-frow">
              <div className="ml-field">
                <label>Customer name</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Required for a real invoice" />
              </div>
              <div className="ml-field">
                <label>Customer email</label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>
            </div>
            <div className="ml-field">
              <label>Service address</label>
              <textarea value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} placeholder="Where work was performed" />
            </div>

            <div className="ml-fsec">Payor (if different from customer)</div>
            <div className="ml-frow">
              <div className="ml-field">
                <label>Payor name</label>
                <input value={payorName} onChange={(e) => setPayorName(e.target.value)} placeholder="Leave blank if same" />
              </div>
              <div className="ml-field">
                <label>Payor email</label>
                <input type="email" value={payorEmail} onChange={(e) => setPayorEmail(e.target.value)} placeholder="Billing contact" />
              </div>
            </div>
            <p className="ml-field-hint">Tax applies to both service charges and travel costs.</p>

            <div className="ml-fsec">Line items</div>
            <div className="ml-li-header">
              <span className="ml-li-col-lbl">Description</span>
              <span className="ml-li-col-lbl" style={{ textAlign: 'center' }}>
                Qty
              </span>
              <span className="ml-li-col-lbl" style={{ textAlign: 'right' }}>
                Rate
              </span>
              <span className="ml-li-col-lbl" style={{ textAlign: 'right' }}>
                Amt
              </span>
              <span />
            </div>
            {items.map((it, i) => (
              <div key={i} className="ml-li-row">
                <input
                  type="text"
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  style={{ textAlign: 'center' }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={it.rate}
                  onChange={(e) => updateItem(i, 'rate', e.target.value)}
                  style={{ textAlign: 'right' }}
                />
                <input className="ml-li-amt-readonly" readOnly value={`$${lineAmount(it.quantity, it.rate).toFixed(2)}`} />
                <button type="button" className="ml-btn-rm" onClick={() => removeItem(i)} title="Remove" disabled={items.length <= 1}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="ml-btn-add" onClick={addItem}>
              + Add line item
            </button>

            <div className="ml-fsec">Tax rate (%)</div>
            <div className="ml-field">
              <label>Applied to service charge only</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>

            <div className="ml-fsec">Travel costs (optional)</div>
            <div className="ml-tr-header">
              <span className="ml-li-col-lbl">Description</span>
              <span className="ml-li-col-lbl" style={{ textAlign: 'right' }}>
                Amount ($)
              </span>
              <span />
            </div>
            {travelRows.map((t, i) => (
              <div key={i} className="ml-tr-row">
                <input
                  type="text"
                  placeholder="e.g. Travel: Toronto → Mississauga"
                  value={t.description}
                  onChange={(e) => updateTravel(i, 'description', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={t.amount}
                  onChange={(e) => updateTravel(i, 'amount', e.target.value)}
                  style={{ textAlign: 'right' }}
                />
                <button type="button" className="ml-btn-rm" onClick={() => removeTravelRow(i)} title="Remove">
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="ml-btn-add" onClick={addTravelRow}>
              + Add travel line
            </button>

            <div className="ml-fsec">Notes</div>
            <div className="ml-field">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank you, etc." />
            </div>

            <button type="button" className="ml-btn-dl" onClick={downloadPDF} disabled={pdfBusy}>
              {pdfBusy ? (
                <>Generating…</>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
            <div className="ml-free-note">No account · Same structure as signed-in invoices · Free download</div>
          </div>

          <div className="ml-preview-wrap">
            <div className="ml-prev-lbl">Live preview</div>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'rgba(250,246,239,0.4)',
                margin: '0 0 12px',
                lineHeight: 1.5,
              }}
            >
              Header colours match Invoice Generator templates (saved invoices use your chosen template in the app).
            </p>
            <div className="ml-template-picker">
              {Object.entries(HEADER_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  className={headerTemplate === key ? 'ml-tpl-active' : ''}
                  style={{ background: t.bg, color: t.text, borderColor: 'rgba(255,255,255,0.25)' }}
                  title={t.name}
                  onClick={() => setHeaderTemplate(key)}
                >
                  <span style={{ marginRight: '6px' }}>{t.palette}</span>
                  {t.name}
                </button>
              ))}
            </div>
            <div className="ml-prev-card ml-prev-flush">
              <div
                id="invoice-preview"
                className="invoice-preview invoice-compact"
                style={{
                  margin: 0,
                  maxWidth: 'none',
                  boxShadow: 'none',
                  borderRadius: 0,
                }}
              >
                <div
                  style={{
                    backgroundColor: currentTemplate.bg,
                    color: currentTemplate.text,
                    padding: '32px',
                    borderRadius: '8px 8px 0 0',
                    textAlign: 'center',
                    marginBottom: '0',
                  }}
                >
                  <h1
                    style={{
                      fontSize: '42px',
                      fontWeight: '700',
                      margin: '0 0 8px 0',
                      letterSpacing: '-1px',
                    }}
                  >
                    INVOICE
                  </h1>
                  <div style={{ fontSize: '20px', fontWeight: '600', opacity: 0.9 }}>{invoiceNumber || 'INV-…'}</div>
                </div>

                {/* Metadata row — mirrors InvoiceGenerator layout */}
                <div
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
                  <div><strong>Date:</strong> {invoiceDate || '—'}</div>
                  {dueDate && <div><strong>Due date:</strong> {dueDate}</div>}
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
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>{previewCompanyLine}</div>
                    {operationalNameDba.trim() && (
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                        DBA: {operationalNameDba.trim()}
                      </div>
                    )}
                    {companyAddress.trim() && (
                      <div style={{ fontSize: '14px', color: '#666', whiteSpace: 'pre-line', marginBottom: '4px' }}>
                        {companyAddress.trim()}
                      </div>
                    )}
                    {gstNumber.trim() && (
                      <div style={{ fontSize: '14px', color: '#666' }}>HST/GST: {gstNumber.trim()}</div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>BILL TO</div>
                    <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                      {customerName.trim() || 'Customer name'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{customerEmail.trim() || '—'}</div>
                    {showPayorBlock && (
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#555',
                          marginTop: '8px',
                          padding: '8px',
                          background: '#f8f9fa',
                          borderRadius: '6px',
                        }}
                      >
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>Payor</div>
                        {payorName.trim() && <div>{payorName.trim()}</div>}
                        {payorEmail.trim() && <div>{payorEmail.trim()}</div>}
                      </div>
                    )}
                    {serviceAddress.trim() && (
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                        Service Address:
                        <br />
                        {serviceAddress.trim()}
                      </div>
                    )}
                  </div>
                </div>

                {serviceStartDate && serviceEndDate ? (
                  <div
                    style={{
                      margin: '0 32px 16px',
                      padding: '12px 16px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      borderLeft: '4px solid #1e3a5f',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>Service period</div>
                    {serviceStartDate} → {serviceEndDate}
                  </div>
                ) : null}

                <table className="items-table" style={{ margin: '0 0 24px', width: 'calc(100% - 64px)', marginLeft: '32px' }}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="text-center">Quantity</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: '#999', fontStyle: 'italic', fontSize: '0.85rem' }}>
                          Add line items on the left
                        </td>
                      </tr>
                    ) : (
                      validItems.map((it, idx) => {
                        const qq = parseFloat(it.quantity);
                        const q = Number.isFinite(qq) && qq >= 0 ? qq : 1;
                        const rr = parseFloat(it.rate);
                        const r = Number.isFinite(rr) ? rr : 0;
                        return (
                          <tr key={`it-${idx}`}>
                            <td>{it.description || '—'}</td>
                            <td className="text-center">{q}</td>
                            <td className="text-right">${r.toFixed(2)}</td>
                            <td className="text-right item-amount">${(q * r).toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                    {travelRows.map((t, idx) => {
                      const a = parseFloat(t.amount);
                      const amt = Number.isFinite(a) ? a : 0;
                      if (!t.description?.trim() && amt <= 0) return null;
                      return (
                        <tr key={`tr-${idx}`}>
                          <td>{t.description || 'Travel'}</td>
                          <td className="text-center">1</td>
                          <td className="text-right">${amt.toFixed(2)}</td>
                          <td className="text-right item-amount">${amt.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ padding: '0 32px' }} className="invoice-footer">
                  <div className="footer-left">
                    {notes.trim() ? (
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Notes</h3>
                        <div style={{ fontSize: '13px', color: '#666' }}>{notes.trim()}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="totals-box">
                    <div className="total-row">
                      <span>Services:</span>
                      <span className="total-value">${subtotal.toFixed(2)}</span>
                    </div>
                    {travelTotal > 0 ? (
                      <div className="total-row">
                        <span>Travel costs:</span>
                        <span className="total-value">${travelTotal.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="total-row">
                      <span>Tax ({Number.isFinite(taxPct) ? taxPct : 0}%):</span>
                      <span className="total-value">${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="total-row grand-total">
                      <span>Total:</span>
                      <span>${grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: '14px 16px',
                  fontSize: '12px',
                  color: 'rgba(0,0,0,0.45)',
                  textAlign: 'center',
                  borderTop: '1px solid #eee',
                  background: '#fafafa',
                }}
              >
                Same layout as Invoice Generator preview · Click2Bill
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ml-features-sec" id="features">
        <div style={{ textAlign: 'center' }}>
          <span className="ml-section-tag">In the full app</span>
          <h2 className="ml-section-title" style={{ margin: '0 auto 16px' }}>
            Multi-currency, payments,
            <br />
            and your full workflow.
          </h2>
          <p className="ml-section-sub" style={{ margin: '0 auto 60px' }}>
            The free builder uses the same totals logic as the app: subtotal, travel, tax, then grand total. The full
            platform extends that with multi-currency billing and support for payments through leading payment platforms.
          </p>
        </div>
        <div className="ml-features-grid ml-reveal">
          <div className="ml-feat-card">
            <div className="ml-feat-icon ml-fi-orange">👤</div>
            <h3 className="ml-feat-title">Customers &amp; payors</h3>
            <p className="ml-feat-desc">
              Store customer profiles with service address and separate payor when billing goes to another contact.
            </p>
          </div>
          <div className="ml-feat-card">
            <div className="ml-feat-icon ml-fi-brown">🚗</div>
            <h3 className="ml-feat-title">Travel records</h3>
            <p className="ml-feat-desc">Attach mileage trips to invoices or record your trips for each service appointment.</p>
          </div>
          <div className="ml-feat-card">
            <div className="ml-feat-icon ml-fi-blue">✓</div>
            <h3 className="ml-feat-title">Maker–checker</h3>
            <p className="ml-feat-desc">Optional workflow: draft, approve, then issue to the customer with email delivery.</p>
          </div>
          <div className="ml-feat-card">
            <div className="ml-feat-icon ml-fi-purple">🏢</div>
            <h3 className="ml-feat-title">Company &amp; GST</h3>
            <p className="ml-feat-desc">Legal name, address, and HST/GST on every issued invoice — same blocks as the builder.</p>
          </div>
          <div className="ml-feat-card">
            <div className="ml-feat-icon ml-fi-green">💱</div>
            <h3 className="ml-feat-title">Multi-currency</h3>
            <p className="ml-feat-desc">
              Bill in the currency your clients use—clear symbols, line amounts, and totals so international and cross-border
              work stays consistent from quote to paid invoice.
            </p>
          </div>
          <div className="ml-feat-card ml-feat-card--accent">
            <div className="ml-feat-icon ml-fi-gold">🔗</div>
            <h3 className="ml-feat-title">Xero &amp; QuickBooks ready</h3>
            <p className="ml-feat-desc">
              Export your invoice history in one click as a Xero import CSV or a QuickBooks Online import CSV—line items,
              GST/HST amounts, payment terms, and travel expenses all formatted to each platform's exact column spec.
            </p>
          </div>
        </div>
      </section>

      <section className="ml-how-section" id="how">
        <span className="ml-section-tag">How it works</span>
        <h2 className="ml-section-title">From PDF to full platform.</h2>
        <p className="ml-section-sub" style={{ marginBottom: '60px' }}>
          Start with the free PDF builder, then register to sync company data, save invoices, and use travel and visits.
        </p>
        <div className="ml-steps-grid ml-reveal">
          <div className="ml-step">
            <div className="ml-step-num">01</div>
            <h3 className="ml-step-title">Try the builder</h3>
            <p className="ml-step-desc">Fill the same fields you will use in the app and download a PDF.</p>
          </div>
          <div className="ml-step">
            <div className="ml-step-num">02</div>
            <h3 className="ml-step-title">Register company</h3>
            <p className="ml-step-desc">Create an account and complete company profile for automatic headers and GST.</p>
          </div>
          <div className="ml-step">
            <div className="ml-step-num">03</div>
            <h3 className="ml-step-title">Add customers &amp; work</h3>
            <p className="ml-step-desc">Calculate or record service trips and open the invoice screen from the dashboard.</p>
          </div>
          <div className="ml-step">
            <div className="ml-step-num">04</div>
            <h3 className="ml-step-title">Issue &amp; track</h3>
            <p className="ml-step-desc">Save, send, and mark paid — customer view uses the same totals breakdown.</p>
          </div>
        </div>
      </section>

      {/* ── About Us ─────────────────────────────────────────────────── */}
      <section className="ml-about-section" id="about">
        <div className="ml-about-inner ml-reveal">
          <span className="ml-section-tag">About us</span>
          <h2 className="ml-section-title" style={{ maxWidth: '680px', margin: '16px auto 28px' }}>
            Built by a believer in the digital revolution.
          </h2>
          <div className="ml-about-body">
            <p>
              Click2Bill was founded by a professional who experienced first-hand the inefficiency
              of paper invoices, missed payments, and manual mileage logs. The conviction was
              simple: <strong>every service business, regardless of size, deserves the same
              digital billing power that large enterprises take for granted.</strong>
            </p>
            <p>
              The platform brings together e-billing, travel cost tracking, multi-currency
              support, and a structured maker–checker approval workflow — all in one place.
              No spreadsheets, no chasing receipts, no end-of-month reconciliation panic.
            </p>
            <p>
              We believe that digitising billing is not just about convenience — it is about
              accountability, speed, and building trust with your customers. From the first
              PDF sent to an approved, signed invoice delivered in seconds, Click2Bill is
              designed to grow with you.
            </p>
            <p className="ml-about-tagline">
              <em>Digital billing. Real results.</em>
            </p>
          </div>
        </div>
      </section>

      <section className="ml-cta-section">
        <h2 className="ml-cta-title">Ready to use the full e-billing workflow?</h2>
        <p>Sign in to the portal to save invoices, manage customers, track travel, and issue from the same layout you previewed here.</p>
        <div className="ml-cta-actions">
          <button type="button" className="ml-btn-cta-w" onClick={() => navigate('/login')}>
            Access the portal now →
          </button>
          <button type="button" className="ml-btn-cta-o" onClick={() => navigate('/register')}>
            Create a company account
          </button>
        </div>
      </section>

      <footer className="ml-footer">
        <div className="ml-footer-grid">
          <div className="ml-footer-brand">
            <div className="ml-logo">
              Click<span>2</span>Bill
            </div>
            <p>Full scale e-billing with customer profiles, travel costs, multi-currency support, and optional maker–checker approval.</p>
          </div>
          <div className="ml-footer-col">
            <h4>Product</h4>
            <ul>
              <li>
                <button type="button" onClick={scrollToCreate}>
                  Free PDF invoice
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/login')}>
                  Access to Portal
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/register')}>
                  Sign up — company
                </button>
              </li>
            </ul>
          </div>
          <div className="ml-footer-col">
            <h4>Paying an invoice?</h4>
            <ul>
              <li>
                <button type="button" onClick={() => navigate('/login')}>
                  Customer sign in
                </button>
              </li>
            </ul>
          </div>
          <div className="ml-footer-col">
            <h4>Contact us</h4>
            <ul>
              <li className="ml-footer-contact-item">
                <span className="ml-footer-contact-icon">📍</span>
                60 Fairwood Circle, Unit&nbsp;46<br />Brampton, ON L6R&nbsp;0Y6
              </li>
              <li className="ml-footer-contact-item" style={{ marginTop: '10px' }}>
                <span className="ml-footer-contact-icon">✉️</span>
                <a href="mailto:click2Bill.ca@gmail.com" className="ml-footer-email">
                  click2Bill.ca@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="ml-footer-bottom">
          <span>© {new Date().getFullYear()} Click2Bill</span>
          <span>Full scale e-billing platform for service businesses</span>
        </div>
      </footer>
    </div>
  );
}
