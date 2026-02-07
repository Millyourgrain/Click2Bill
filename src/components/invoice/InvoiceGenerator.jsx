import React, { useState, useRef, useEffect } from 'react';
import { Download, Plus, Trash2, Upload, X, Send } from 'lucide-react';

function InvoiceGenerator({ travelCostItem }) {
  const [step, setStep] = useState('form');
  const [headerTemplate, setHeaderTemplate] = useState('classic');
  const [invoice, setInvoice] = useState({
    invoiceNumber: `INV-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    companyName: '',
    companyAddress: '',
    companyLogo: null,
    gstNumber: '',
    customerName: '',
    customerEmail: '',
    serviceAddress: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    travelItems: [],
    notes: '',
    taxRate: 13,
  });
  
  const [signature, setSignature] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const addedTravelIdsRef = useRef(new Set());
  const signatureRef = useRef(null);

  // ✅ Handle incoming travel cost items
  useEffect(() => {
    if (travelCostItem && travelCostItem.id && !addedTravelIdsRef.current.has(travelCostItem.id)) {
      setInvoice(prev => ({
        ...prev,
        travelItems: [...prev.travelItems, travelCostItem]
      }));
      addedTravelIdsRef.current.add(travelCostItem.id);
    }
  }, [travelCostItem]);

  const headerTemplates = {
    classic: { 
      name: 'Classic White', 
      bg: '#ffffff', 
      text: '#1a1a1a',
      border: '#1a1a1a',
      palette: '⚪'
    },
    professional: { 
      name: 'Professional Navy', 
      bg: '#1e3a5f', 
      text: '#ffffff',
      border: '#1e3a5f',
      palette: '🔵'
    },
    modern: { 
      name: 'Modern Teal', 
      bg: '#008b8b', 
      text: '#ffffff',
      border: '#008b8b',
      palette: '🟢'
    },
    elegant: { 
      name: 'Elegant Purple', 
      bg: '#6a1b9a', 
      text: '#ffffff',
      border: '#6a1b9a',
      palette: '🟣'
    },
    corporate: { 
      name: 'Corporate Gray', 
      bg: '#424242', 
      text: '#ffffff',
      border: '#424242',
      palette: '⚫'
    },
    fresh: { 
      name: 'Fresh Green', 
      bg: '#2e7d32', 
      text: '#ffffff',
      border: '#2e7d32',
      palette: '🟢'
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setInvoice({ ...invoice, companyLogo: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const addItem = () => {
    setInvoice({
      ...invoice,
      items: [...invoice.items, { description: '', quantity: 1, rate: 0, amount: 0 }]
    });
  };

  const removeItem = (index) => {
    const newItems = invoice.items.filter((_, i) => i !== index);
    setInvoice({ ...invoice, items: newItems });
  };

  const removeTravelItem = (index) => {
    const removedItem = invoice.travelItems[index];
    const newTravelItems = invoice.travelItems.filter((_, i) => i !== index);
    setInvoice({ ...invoice, travelItems: newTravelItems });
    
    // Remove from addedTravelIdsRef so it can be re-added if needed
    if (removedItem && removedItem.id) {
      addedTravelIdsRef.current.delete(removedItem.id);
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...invoice.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    setInvoice({ ...invoice, items: newItems });
  };

  // ✅ Calculate subtotal (regular items only - these will be taxed)
  const calculateSubtotal = () => {
    return invoice.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  // ✅ Calculate tax (only on regular items, NOT on travel)
  const calculateTax = () => {
    return calculateSubtotal() * (invoice.taxRate / 100);
  };

  // ✅ Calculate travel total (tax-exempt)
  const calculateTravelTotal = () => {
    return invoice.travelItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  // ✅ Calculate grand total (subtotal + tax + travel)
  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() + calculateTravelTotal();
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = signatureRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const saveSignature = () => {
    const canvas = signatureRef.current;
    setSignature(canvas.toDataURL());
    setStep('preview');
  };

  const downloadPDF = () => {
    window.print();
  };

  const sendInvoice = () => {
    const subject = `Invoice ${invoice.invoiceNumber} from ${invoice.companyName}`;
    const body = `Dear ${invoice.customerName},\n\nPlease find attached your invoice.\n\nInvoice Number: ${invoice.invoiceNumber}\nTotal Amount: $${calculateTotal().toFixed(2)}\n\nThank you for your business!\n\n${invoice.companyName}`;
    window.location.href = `mailto:${invoice.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const currentTemplate = headerTemplates[headerTemplate];

  return (
    <div className="main-content">
      <div className="step-indicator">
        {['form', 'signature', 'preview'].map((s, idx) => (
          <div key={s} className="step-item">
            <div className={`step-number ${step === s ? 'active' : ''}`}>
              {idx + 1}
            </div>
            <span className={`step-label ${step === s ? 'active' : ''}`}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {step === 'form' && (
        <div className="form-container">
          <h2 className="section-title">Invoice Details</h2>

          <div className="form-section">
            <h3 className="subsection-title">Invoice Header Template</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {Object.entries(headerTemplates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => setHeaderTemplate(key)}
                  style={{
                    padding: '16px',
                    backgroundColor: template.bg,
                    color: template.text,
                    border: headerTemplate === key ? '3px solid #007bff' : '2px solid #dee2e6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{template.palette}</span>
                  <span>{template.name}</span>
                  {headerTemplate === key && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '4px', 
                      right: '8px',
                      fontSize: '16px'
                    }}>✓</span>
                  )}
                </button>
              ))}
            </div>
            <small style={{ color: "#666", fontSize: "0.85rem" }}>
              This template will be applied to the invoice header in the PDF
            </small>
          </div>

          <div className="form-section">
            <h3 className="subsection-title">Company Information</h3>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input
                  type="text"
                  value={invoice.companyName}
                  onChange={(e) => setInvoice({ ...invoice, companyName: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">GST/HST Number</label>
                <input
                  type="text"
                  value={invoice.gstNumber}
                  onChange={(e) => setInvoice({ ...invoice, gstNumber: e.target.value })}
                  placeholder="Optional"
                  className="form-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Company Address</label>
              <textarea
                value={invoice.companyAddress}
                onChange={(e) => setInvoice({ ...invoice, companyAddress: e.target.value })}
                rows={2}
                className="form-textarea"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Company Logo</label>
              <div className="logo-upload-container">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                  id="logo-upload"
                />
                <label htmlFor="logo-upload" className="upload-button">
                  <Upload size={18} />
                  Upload Logo
                </label>
                {invoice.companyLogo && (
                  <div className="logo-preview">
                    <img src={invoice.companyLogo} alt="Logo" className="logo-image" />
                    <button
                      onClick={() => setInvoice({ ...invoice, companyLogo: null })}
                      className="remove-logo-button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="subsection-title">Invoice Information</h3>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input
                  type="text"
                  value={invoice.invoiceNumber}
                  onChange={(e) => setInvoice({ ...invoice, invoiceNumber: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  value={invoice.date}
                  onChange={(e) => setInvoice({ ...invoice, date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  value={invoice.dueDate}
                  onChange={(e) => setInvoice({ ...invoice, dueDate: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="subsection-title">Customer Information</h3>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  type="text"
                  value={invoice.customerName}
                  onChange={(e) => setInvoice({ ...invoice, customerName: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Email *</label>
                <input
                  type="email"
                  value={invoice.customerEmail}
                  onChange={(e) => setInvoice({ ...invoice, customerEmail: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Service Address</label>
              <textarea
                value={invoice.serviceAddress}
                onChange={(e) => setInvoice({ ...invoice, serviceAddress: e.target.value })}
                rows={2}
                className="form-textarea"
              />
            </div>
          </div>

          <div className="form-section">
            <div className="items-header">
              <h3 className="subsection-title">Line Items</h3>
              <button onClick={addItem} className="add-item-button">
                <Plus size={18} />
                Add Item
              </button>
            </div>
            
            {invoice.items.map((item, index) => (
              <div key={index} className="item-row">
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate ($)</label>
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input
                    type="text"
                    value={item.amount.toFixed(2)}
                    readOnly
                    className="form-input readonly"
                  />
                </div>
                <button
                  onClick={() => removeItem(index)}
                  disabled={invoice.items.length === 1}
                  className="remove-item-button"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Tax Rate (%)</label>
              <input
                type="number"
                value={invoice.taxRate}
                onChange={(e) => setInvoice({ ...invoice, taxRate: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.01"
                className="form-input tax-input"
              />
            </div>
          </div>

          {/* Travel Items Section */}
          {invoice.travelItems.length > 0 && (
            <div className="form-section">
              <div className="items-header">
                <h3 className="subsection-title">🚗 Travel Costs</h3>
              </div>
              
              {invoice.travelItems.map((item, index) => (
                <div key={index} style={{
                  padding: '16px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '2px solid #4caf50'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: '#2e7d32' }}>
                      {item.description}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      Amount: ${item.amount.toFixed(2)}
                    </div>
                    {item.date && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Travel Date: {item.date}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeTravelItem(index)}
                    className="remove-item-button"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Notes / Terms</label>
              <textarea
                value={invoice.notes}
                onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                rows={3}
                placeholder="Payment terms, notes, or additional information..."
                className="form-textarea"
              />
            </div>
          </div>

          {/* Updated Summary Box */}
          <div className="summary-box">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span className="summary-value">${calculateSubtotal().toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Tax ({invoice.taxRate}%):</span>
              <span className="summary-value">${calculateTax().toFixed(2)}</span>
            </div>
            {invoice.travelItems.length > 0 && (
              <div className="summary-row" style={{ 
                color: '#2e7d32',
                backgroundColor: '#e8f5e9',
                padding: '8px',
                borderRadius: '4px',
                marginTop: '8px'
              }}>
                <span>🚗 Travel Costs:</span>
                <span className="summary-value">${calculateTravelTotal().toFixed(2)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Total:</span>
              <span>${calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => setStep('signature')}
            disabled={!invoice.companyName || !invoice.customerName || !invoice.customerEmail}
            className="continue-button"
          >
            Continue to Signature
          </button>
        </div>
      )}

      {step === 'signature' && (
        <div className="form-container">
          <h2 className="section-title">Digital Signature</h2>
          <p className="signature-description">
            Please sign below to authorize this invoice
          </p>

          <div className="signature-canvas-container">
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

          <div className="button-group">
            <button onClick={clearSignature} className="secondary-button">
              Clear Signature
            </button>
            <button onClick={() => setStep('form')} className="secondary-button">
              Back to Form
            </button>
            <button onClick={saveSignature} className="primary-button">
              Save & Continue
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div id="invoice-preview" className="invoice-preview invoice-compact">
            <div 
              className="invoice-header"
              style={{
                backgroundColor: currentTemplate.bg,
                color: currentTemplate.text,
                borderColor: currentTemplate.border
              }}
            >
              <div>
                {invoice.companyLogo && (
                  <img src={invoice.companyLogo} alt="Company Logo" className="invoice-logo" />
                )}
                <h1 className="invoice-title">INVOICE</h1>
                <div className="invoice-number">{invoice.invoiceNumber}</div>
              </div>
              <div className="company-details">
                <div className="company-name">{invoice.companyName}</div>
                <div className="company-address">{invoice.companyAddress}</div>
                {invoice.gstNumber && (
                  <div className="gst-number">GST/HST: {invoice.gstNumber}</div>
                )}
              </div>
            </div>

            <div className="invoice-info-grid">
              <div>
                <h3 className="info-heading">Bill To</h3>
                <div className="customer-name">{invoice.customerName}</div>
                <div className="customer-email">{invoice.customerEmail}</div>
                {invoice.serviceAddress && (
                  <div className="service-address">
                    <strong>Service Address:</strong><br />
                    {invoice.serviceAddress}
                  </div>
                )}
              </div>
              <div>
                <h3 className="info-heading">Invoice Details</h3>
                <div className="invoice-detail">
                  <span className="detail-label">Date: </span>
                  <span className="detail-value">{invoice.date}</span>
                </div>
                {invoice.dueDate && (
                  <div className="invoice-detail">
                    <span className="detail-label">Due Date: </span>
                    <span className="detail-value">{invoice.dueDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Regular Items Table (Taxable) */}
            <table className="items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-center">Quantity</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.description}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">${item.rate.toFixed(2)}</td>
                    <td className="text-right item-amount">${item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="invoice-footer">
              <div className="footer-left">
                {invoice.notes && (
                  <div>
                    <h3 className="info-heading">Notes</h3>
                    <div className="invoice-notes">{invoice.notes}</div>
                  </div>
                )}
              </div>
              <div className="totals-box">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span className="total-value">${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Tax ({invoice.taxRate}%):</span>
                  <span className="total-value">${calculateTax().toFixed(2)}</span>
                </div>
                
                {/* Travel Items - Added to total without separate display */}
                {invoice.travelItems.length > 0 && (
                  <div className="total-row" style={{ 
                    backgroundColor: '#e8f5e9',
                    padding: '8px',
                    marginTop: '8px',
                    borderRadius: '4px',
                    border: '1px solid #4caf50'
                  }}>
                    <span style={{ fontSize: '14px', color: '#2e7d32' }}>
                      Travel Costs:
                    </span>
                    <span className="total-value" style={{ color: '#2e7d32' }}>
                      ${calculateTravelTotal().toFixed(2)}
                    </span>
                  </div>
                )}
                
                <div className="total-row grand-total">
                  <span>Total:</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {signature && (
              <div className="signature-section-footer">
                <div className="signature-label">Authorized Signature</div>
                <img src={signature} alt="Signature" className="signature-image" />
                <div className="signature-date">{new Date().toLocaleDateString()}</div>
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button onClick={() => setStep('form')} className="secondary-button flex-button">
              Edit Invoice
            </button>
            <button onClick={downloadPDF} className="primary-button flex-button">
              <Download size={20} />
              Download PDF
            </button>
            <button onClick={sendInvoice} className="success-button flex-button">
              <Send size={20} />
              Email to Customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceGenerator;