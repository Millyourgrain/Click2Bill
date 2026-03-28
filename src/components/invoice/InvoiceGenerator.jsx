import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Trash2, Send, Home, Mail, FileCheck, CheckCircle, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanyInfo } from '../../services/companyService';
import { getCustomer, getCustomers } from '../../services/customerService';
import { getVisit, getVisitHours, getVisitsHoursInRange } from '../../services/visitService';
import { saveInvoice } from '../../services/invoiceService';
import { getTravelRecords, addTravelRecord } from '../../services/travelRecordService';
import { sendEmail } from '../../services/emailService';

const PENDING_TRAVEL_KEY = 'pendingTravelItem';
const DRAFT_BEFORE_TRAVEL_KEY = 'invoice-draft-before-travel';

/** Format check-in/out for invoice display: "Mon, Feb 27, 2025 • Check-in: 9:00 AM • Check-out: 5:00 PM" */
function formatVisitCheckTimes(visit) {
  if (!visit?.checkInTime || !visit?.checkOutTime) return null;
  const d1 = new Date(visit.checkInTime);
  const d2 = new Date(visit.checkOutTime);
  const dayDate = d1.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const t1 = d1.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
  const t2 = d2.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dayDate} • Check-in: ${t1} • Check-out: ${t2}`;
}

function InvoiceGenerator({ travelCostItem: travelCostItemProp, onTravelCostConsumed }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const visitIdParam = searchParams.get('visitId');
  const customerIdParam = searchParams.get('customerId');
  const { currentUser } = useAuth();

  const [step, setStep] = useState('form');
  const [headerTemplate, setHeaderTemplate] = useState('professional');
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState('15_before_due');
  const [isSaving, setIsSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);

  const [invoice, setInvoice] = useState({
    invoiceNumber: `INV-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    serviceStartDate: '',
    serviceEndDate: '',
    customerName: '',
    customerEmail: '',
    serviceAddress: '',
    payorName: '',
    payorEmail: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    travelItems: [],
    notes: '',
    taxRate: 13,
    hoursWorked: null,
    ratePerHour: null,
  });
  const [visitId, setVisitId] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [servicePeriodVisits, setServicePeriodVisits] = useState([]); // visits with check-in/out for invoice display

  const [signature, setSignature] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [travelRecords, setTravelRecords] = useState([]);
  const [showTravelPicker, setShowTravelPicker] = useState(false);
  const [loadingTravelRecords, setLoadingTravelRecords] = useState(false);
  const addedTravelIdsRef = useRef(new Set());
  const signatureRef = useRef(null);
  const hasSavedAfterLoadRef = useRef(false);

  const STORAGE_KEY = 'invoice-form-draft';

  const saveDraft = () => {
    try {
      const draft = {
        invoice: { ...invoice },
        step,
        headerTemplate,
        visitId,
        customerId,
        servicePeriodVisits,
        signature,
        reminderEnabled,
        reminderFrequency,
        addedTravelIds: Array.from(addedTravelIdsRef.current),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (e) { /* ignore */ }
  };

  const loadDraftFromStorage = (key = STORAGE_KEY) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      if (draft.invoice) {
        const inv = draft.invoice;
        if (inv.items && Array.isArray(inv.items)) {
          inv.items = inv.items.map((it) => {
            const qty = (it.quantity != null && !isNaN(Number(it.quantity)) && Number(it.quantity) > 0) ? Number(it.quantity) : 1;
            const rt = (it.rate != null && !isNaN(it.rate)) ? Number(it.rate) : (it.rate ?? 0);
            return {
              ...it,
              quantity: qty,
              rate: rt,
              amount: (it.amount != null && !isNaN(it.amount) && it.amount >= 0) ? Number(it.amount) : (qty * rt),
            };
          });
        }
        if (!Array.isArray(inv.travelItems)) inv.travelItems = [];
        inv.travelItems = inv.travelItems.map((t) => ({
          ...t,
          quantity: (t.quantity != null && !isNaN(t.quantity)) ? Number(t.quantity) : 1,
        }));
        setInvoice(inv);
      }
      if (draft.step) setStep(draft.step);
      if (draft.headerTemplate) setHeaderTemplate(draft.headerTemplate);
      if (draft.visitId) setVisitId(draft.visitId);
      if (draft.customerId) setCustomerId(draft.customerId);
      if (draft.servicePeriodVisits?.length) setServicePeriodVisits(draft.servicePeriodVisits);
      if (draft.signature) setSignature(draft.signature);
      if (draft.reminderEnabled != null) setReminderEnabled(draft.reminderEnabled);
      if (draft.reminderFrequency) setReminderFrequency(draft.reminderFrequency);
      if (draft.addedTravelIds?.length) draft.addedTravelIds.forEach((id) => addedTravelIdsRef.current.add(id));
      return true;
    } catch (e) { return false; }
  };

  const loadDraft = () => {
    const hasPending = !!sessionStorage.getItem(PENDING_TRAVEL_KEY);
    if (hasPending && sessionStorage.getItem(DRAFT_BEFORE_TRAVEL_KEY)) {
      const loaded = loadDraftFromStorage(DRAFT_BEFORE_TRAVEL_KEY);
      if (loaded) sessionStorage.removeItem(DRAFT_BEFORE_TRAVEL_KEY);
      return loaded;
    }
    return loadDraftFromStorage(STORAGE_KEY);
  };

  useEffect(() => {
    loadCompanyData();
  }, []);

  useEffect(() => {
    if (loadingCompany || visitIdParam || customerIdParam) return;
    const hadPendingTravel = !!sessionStorage.getItem(PENDING_TRAVEL_KEY);
    loadDraft();
    if (hadPendingTravel) setStep('form');
  }, [loadingCompany, visitIdParam, customerIdParam]);

  useEffect(() => {
    if (loadingCompany || visitIdParam || customerIdParam) return;
    const pending = sessionStorage.getItem(PENDING_TRAVEL_KEY);
    if (!pending) return;
    const processPending = () => {
      try {
        const item = JSON.parse(pending);
        sessionStorage.removeItem(PENDING_TRAVEL_KEY);
        if (!item || typeof item !== 'object' || !item.id || addedTravelIdsRef.current.has(item.id)) return;
        const quoteTravel = companyInfo?.quoteTravelCostOnInvoice !== false;
        if (quoteTravel) {
          const amount = (item.amount != null && !isNaN(Number(item.amount))) ? Number(item.amount) : (item.rate ?? 0);
          const rate = (item.rate != null && !isNaN(Number(item.rate))) ? Number(item.rate) : amount;
          const safeItem = { ...item, amount, rate, quantity: 1 };
          setInvoice((prev) => ({
            ...prev,
            travelItems: [...(prev.travelItems || []), safeItem],
          }));
          addedTravelIdsRef.current.add(item.id);
        }
        const rec = {
          distanceKm: item.distanceKm ?? (item.roundTripKm ? item.roundTripKm / 2 : 0),
          roundTripKm: item.roundTripKm ?? (item.distanceKm ? item.distanceKm * 2 : 0),
          travelDate: item.date || new Date().toISOString().split('T')[0],
          origin: item.origin || '',
          destination: item.destination || '',
          description: item.description || '',
          totalCost: item.amount ?? item.rate ?? 0,
        };
        addTravelRecord(rec).catch((e) => console.warn('Travel record save failed:', e));
        onTravelCostConsumed?.();
      } catch (e) {
        console.warn('Could not parse pending travel item:', e);
        sessionStorage.removeItem(PENDING_TRAVEL_KEY);
      }
    };
    const timer = setTimeout(processPending, 250);
    return () => clearTimeout(timer);
  }, [loadingCompany, companyInfo, visitIdParam, customerIdParam, onTravelCostConsumed]);

  useEffect(() => {
    if (!hasSavedAfterLoadRef.current) {
      hasSavedAfterLoadRef.current = true;
      return;
    }
    if (step !== 'preview' || !savedInvoiceId) saveDraft();
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [invoice, step, headerTemplate, visitId, customerId, servicePeriodVisits, signature, reminderEnabled, reminderFrequency, savedInvoiceId]);

  useEffect(() => {
    getCustomers().then((r) => r.success && setCustomers(r.data || []));
  }, []);

  const loadCompanyData = async () => {
    try {
      const result = await getCompanyInfo();
      if (result.success && result.data) {
        setCompanyInfo(result.data);
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    }
    setLoadingCompany(false);
  };

  useEffect(() => {
    if (customerIdParam) {
      setCustomerId(customerIdParam);
      getCustomer(customerIdParam).then((r) => {
        if (r.success && r.data) {
          const c = r.data;
          setInvoice((prev) => ({
            ...prev,
            customerName: c.customerName || prev.customerName,
            customerEmail: c.customerEmail || prev.customerEmail,
            customerPhone: c.customerPhone,
            serviceAddress: c.serviceAddress || prev.serviceAddress,
            payorName: c.isPayorSameAsCustomer ? '' : (c.payorName || prev.payorName || ''),
            payorEmail: c.isPayorSameAsCustomer ? c.customerEmail : c.payorEmail || c.customerEmail,
          }));
        }
      });
    }
  }, [customerIdParam]);

  useEffect(() => {
    if (visitIdParam) {
      setVisitId(visitIdParam);
      getVisit(visitIdParam).then((r) => {
        if (r.success && r.data) {
          const v = r.data;
          const hours = getVisitHours(v);
          if (v.checkInTime && v.checkOutTime) {
            setServicePeriodVisits([{ serviceDate: v.serviceDate, checkInTime: v.checkInTime, checkOutTime: v.checkOutTime }]);
          }
          setInvoice((prev) => {
            const rate = prev.ratePerHour || 0;
            const serviceCharge = hours * rate;
            return {
              ...prev,
              serviceStartDate: v.serviceDate || prev.serviceStartDate,
              serviceEndDate: v.serviceDate || prev.serviceEndDate,
              customerName: v.customerName || prev.customerName,
              serviceAddress: v.serviceAddress || prev.serviceAddress,
              hoursWorked: hours,
              ratePerHour: rate,
              items: hours > 0 && prev.items?.length
                ? [{ description: 'Professional service', quantity: hours, rate, amount: serviceCharge }, ...(prev.items.slice(1) || [])]
                : prev.items,
            };
          });
        }
      });
    }
  }, [visitIdParam]);

  // Calculate hours from check-in/out for customer + date range (when no single visit)
  useEffect(() => {
    if (visitIdParam || !customerId || !invoice.serviceStartDate || !invoice.serviceEndDate) return;
    let cancelled = false;
    (async () => {
      const res = await getVisitsHoursInRange(customerId, invoice.serviceStartDate, invoice.serviceEndDate);
      if (cancelled || !res.success) return;
      const hours = res.totalHours;
      const visits = res.visits || [];
      const withCheckTimes = visits.filter((v) => v.checkInTime && v.checkOutTime);
      if (withCheckTimes.length) setServicePeriodVisits(withCheckTimes);
      setInvoice((prev) => {
        const rate = prev.ratePerHour ?? 0;
        const serviceCharge = hours * rate;
        const firstItem = prev.items?.[0];
        const isFromVisitSync = firstItem?.description === 'Professional service';
        const isDefaultEmpty = !firstItem?.description && (firstItem?.quantity === 1 || firstItem?.quantity == null) && (firstItem?.rate === 0 || firstItem?.rate == null);
        // Only overwrite when we have meaningful hours AND first item is from visit sync or default; never overwrite user-entered data
        const shouldOverwrite = hours > 0 && prev.items?.length && (isFromVisitSync || isDefaultEmpty);
        const newItems = shouldOverwrite
          ? [{ description: 'Professional service', quantity: hours, rate, amount: serviceCharge }, ...(prev.items.slice(1) || [])]
          : prev.items;
        return { ...prev, hoursWorked: hours, items: newItems };
      });
    })();
    return () => { cancelled = true; };
  }, [customerId, invoice.serviceStartDate, invoice.serviceEndDate, visitIdParam]);

  const travelCostItem = travelCostItemProp;
  useEffect(() => {
    if (!travelCostItem || !travelCostItem.id || loadingCompany) return;
    if (addedTravelIdsRef.current.has(travelCostItem.id)) return;

    const quoteTravel = companyInfo?.quoteTravelCostOnInvoice !== false;
    if (quoteTravel) {
      const safeItem = {
        ...travelCostItem,
        amount: (travelCostItem.amount != null && !isNaN(travelCostItem.amount)) ? Number(travelCostItem.amount) : 0,
        rate: (travelCostItem.rate != null && !isNaN(travelCostItem.rate)) ? Number(travelCostItem.rate) : 0,
      };
      setInvoice((prev) => ({
        ...prev,
        travelItems: [...(prev.travelItems || []), safeItem],
      }));
      addedTravelIdsRef.current.add(travelCostItem.id);
    }
    const rec = {
      distanceKm: travelCostItem.distanceKm ?? (travelCostItem.roundTripKm ? travelCostItem.roundTripKm / 2 : 0),
      roundTripKm: travelCostItem.roundTripKm ?? (travelCostItem.distanceKm ? travelCostItem.distanceKm * 2 : 0),
      travelDate: travelCostItem.date || new Date().toISOString().split('T')[0],
      origin: travelCostItem.origin || '',
      destination: travelCostItem.destination || '',
      description: travelCostItem.description || '',
      totalCost: travelCostItem.amount ?? travelCostItem.rate ?? 0,
    };
    addTravelRecord(rec).catch((e) => console.warn('Travel record save failed:', e));
    onTravelCostConsumed?.();
  }, [travelCostItem, loadingCompany, companyInfo, onTravelCostConsumed]);

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

  const calculateSubtotal = () => {
    return invoice.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const calculateServiceCharge = () => calculateSubtotal();

  const calculateTax = () => {
    return calculateSubtotal() * (invoice.taxRate / 100);
  };

  const calculateTravelTotal = () => {
    return invoice.travelItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() + calculateTravelTotal();
  };

  const loadTravelRecordsForPicker = async () => {
    setShowTravelPicker(true);
    setLoadingTravelRecords(true);
    const res = await getTravelRecords();
    setTravelRecords(res.success ? (res.data || []) : []);
    setLoadingTravelRecords(false);
  };

  const addTravelRecordToInvoice = (rec) => {
    if (companyInfo?.quoteTravelCostOnInvoice === false) return;
    const id = `travel-rec-${rec.id}`;
    if (addedTravelIdsRef.current.has(id)) return;
    const amount = rec.totalCost != null ? Number(rec.totalCost) : 0;
    const desc = rec.description || `Travel: ${rec.origin || ''} to ${rec.destination || ''} (${(rec.roundTripKm ?? rec.distanceKm * 2 ?? 0).toFixed(1)} km)`;
    const item = { id, description: desc, quantity: 1, rate: amount, amount, date: rec.travelDate, isTaxExempt: true, type: 'travel' };
    setInvoice((prev) => ({ ...prev, travelItems: [...prev.travelItems, item] }));
    addedTravelIdsRef.current.add(id);
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
    setStep('delivery');
  };

  const handleSaveInvoice = async (status = 'sent', method = null) => {
    setIsSaving(true);
    try {
      const invoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        dueDate: invoice.dueDate,
        serviceStartDate: invoice.serviceStartDate || null,
        serviceEndDate: invoice.serviceEndDate || null,
        visitId: visitId || null,
        customerId: customerId || null,
        servicePeriodVisits: servicePeriodVisits.length ? servicePeriodVisits.map((v) => ({ serviceDate: v.serviceDate, checkInTime: v.checkInTime, checkOutTime: v.checkOutTime })) : [],
        companyName: companyInfo?.companyName || companyInfo?.legalBusinessName || '',
        legalBusinessName: companyInfo?.legalBusinessName || companyInfo?.companyName || '',
        operationalNameDba: companyInfo?.operationalNameDba || '',
        companyAddress: companyInfo?.companyAddress || '',
        companyLogo: companyInfo?.logoUrl || '',
        gstNumber: companyInfo?.gstNumber || '',
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        serviceAddress: invoice.serviceAddress,
        payorName: invoice.payorName || '',
        payorEmail: invoice.payorEmail || invoice.customerEmail,
        items: invoice.items,
        travelItems: invoice.travelItems,
        hoursWorked: invoice.hoursWorked,
        ratePerHour: invoice.ratePerHour,
        subtotal: calculateSubtotal(),
        taxRate: invoice.taxRate,
        tax: calculateTax(),
        travelTotal: calculateTravelTotal(),
        total: calculateTotal(),
        notes: invoice.notes,
        signature: signature,
        headerTemplate: headerTemplate,
        status: status,
        deliveryMethod: method,
        reminderEnabled: method ? reminderEnabled : false,
        reminderFrequency: method ? reminderFrequency : null,
      };
      const result = await saveInvoice(invoiceData);
      
      if (result.success) {
        if (status === 'sent' && (invoice.travelItems || []).length > 0) {
          for (const item of invoice.travelItems) {
            if (item.id && item.id.startsWith('travel-') && !item.id.startsWith('travel-rec-')) {
              const rec = {
                distanceKm: item.distanceKm ?? (item.roundTripKm ? item.roundTripKm / 2 : 0),
                roundTripKm: item.roundTripKm ?? (item.distanceKm ? item.distanceKm * 2 : 0),
                travelDate: item.date || new Date().toISOString().split('T')[0],
                origin: item.origin || '',
                destination: item.destination || '',
                description: item.description || '',
                totalCost: item.amount ?? item.rate ?? 0,
              };
              addTravelRecord(rec).catch((e) => console.warn('Travel record save failed:', e));
            }
          }
        }
        setSavedInvoiceId(result.data.id);
        setStep('preview');
        return true;
      } else {
        alert('Failed to save invoice: ' + result.error);
        return false;
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save invoice');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ FEATURE 6: Delivery method selection
  const handleDeliveryChoice = async (method) => {
    setDeliveryMethod(method);
    const saved = await handleSaveInvoice('sent', method);

    if (saved && method === 'email') {
      await sendInvoice();
    }
  };

  const downloadPDF = () => {
    window.print();
  };

  const sendInvoice = async () => {
    const emailTo = invoice.payorEmail || invoice.customerEmail;
    if (!emailTo) {
      alert('No customer or payor email on the invoice.');
      return;
    }
    setSendingEmail(true);
    const subject = `Invoice ${invoice.invoiceNumber} from ${companyInfo?.companyName || 'Your Company'}`;
    const invoiceLink = savedInvoiceId ? `${window.location.origin}/customer/invoice/${savedInvoiceId}` : '';
    const text = `Dear ${invoice.customerName},\n\nPlease find your invoice below.\n\nInvoice Number: ${invoice.invoiceNumber}\nTotal Amount: $${calculateTotal().toFixed(2)}\n\n${invoiceLink ? `View your invoice: ${invoiceLink}\n\n` : ''}Thank you for your business!\n\n${companyInfo?.companyName || 'Your Company'}`;
    const res = await sendEmail({ to: emailTo, subject, text });
    setSendingEmail(false);
    if (res.success) alert('Invoice sent successfully!');
    else alert(res.error || 'Failed to send email.');
  };

  const currentTemplate = headerTemplates[headerTemplate];

  if (loadingCompany) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading company information...</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="step-indicator">
        {['form', 'signature', 'delivery', 'preview'].map((s, idx) => (
          <div key={s} className="step-item">
            <div className={`step-number ${step === s ? 'active' : ''}`}>
              {idx + 1}
            </div>
            <span className={`step-label ${step === s ? 'active' : ''}`}>
              {s === 'delivery' ? 'Deliver' : s}
            </span>
          </div>
        ))}
      </div>

      {step === 'form' && (
        <div className="form-container">
          <h2 className="section-title">Invoice Details</h2>

          {companyInfo && (
            <div style={{
              background: '#e8f5e9',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '32px',
              border: '2px solid #4caf50'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#2e7d32', fontWeight: '600', marginBottom: '8px' }}>
                    ✅ COMPANY INFO AUTO-LOADED
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '18px', marginBottom: '4px' }}>
                    {companyInfo.companyName}
                  </div>
                  {companyInfo.companyAddress && (
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                      {companyInfo.companyAddress}
                    </div>
                  )}
                  {companyInfo.gstNumber && (
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      GST: {companyInfo.gstNumber}
                    </div>
                  )}
                </div>
                {companyInfo.logoUrl && (
                  <img 
                    src={companyInfo.logoUrl} 
                    alt="Company Logo" 
                    style={{ maxWidth: '100px', maxHeight: '60px', borderRadius: '4px' }}
                  />
                )}
              </div>
            </div>
          )}

          {!companyInfo && (
            <div style={{
              background: '#fff3cd',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '32px',
              border: '2px solid #ffc107'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                ⚠️ Company Profile Not Set Up
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                Please complete your company profile for automatic invoice generation.
              </div>
              <button
                onClick={() => navigate('/setup-company')}
                style={{
                  padding: '8px 16px',
                  background: '#ffc107',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Set Up Company Profile
              </button>
            </div>
          )}

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
                    <span style={{ position: 'absolute', top: '4px', right: '8px', fontSize: '16px' }}>✓</span>
                  )}
                </button>
              ))}
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
            {customers.length > 0 && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Select customer (to auto-fill & calculate hours from visits)</label>
                <select
                  value={customerId || ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setCustomerId(id);
                    if (id) {
                      getCustomer(id).then((r) => {
                        if (r.success && r.data) {
                          const c = r.data;
                          setInvoice((prev) => ({
                            ...prev,
                            customerName: c.customerName || prev.customerName,
                            customerEmail: c.customerEmail || prev.customerEmail,
                            customerPhone: c.customerPhone,
                            serviceAddress: c.serviceAddress || prev.serviceAddress,
                            payorName: c.isPayorSameAsCustomer ? '' : (c.payorName || prev.payorName || ''),
                            payorEmail: c.isPayorSameAsCustomer ? c.customerEmail : (c.payorEmail || c.customerEmail),
                          }));
                        }
                      });
                    }
                  }}
                  className="form-input"
                >
                  <option value="">— Choose customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.customerName || c.customerEmail || c.id}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Customer name *</label>
                <input type="text" value={invoice.customerName} onChange={(e) => setInvoice({ ...invoice, customerName: e.target.value })} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Email *</label>
                <input type="email" value={invoice.customerEmail} onChange={(e) => setInvoice({ ...invoice, customerEmail: e.target.value })} className="form-input" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Service Address</label>
              <textarea value={invoice.serviceAddress} onChange={(e) => setInvoice({ ...invoice, serviceAddress: e.target.value })} rows={2} className="form-textarea" />
            </div>
            <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#555' }}>Payor (if different from customer)</div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Payor Name</label>
                  <input type="text" value={invoice.payorName || ''} onChange={(e) => setInvoice({ ...invoice, payorName: e.target.value })} className="form-input" placeholder="Leave blank if same as customer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Payor Email</label>
                  <input type="email" value={invoice.payorEmail || ''} onChange={(e) => setInvoice({ ...invoice, payorEmail: e.target.value })} className="form-input" placeholder="Billing / payment contact email" />
                </div>
              </div>
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
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #1e3a5f' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>Service period (dates & rate for professional fee)</div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Service start date</label>
                  <input type="date" value={invoice.serviceStartDate} onChange={(e) => setInvoice({ ...invoice, serviceStartDate: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Service end date</label>
                  <input type="date" value={invoice.serviceEndDate} onChange={(e) => setInvoice({ ...invoice, serviceEndDate: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate per hour ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoice.ratePerHour ?? ''}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || null;
                      setInvoice((prev) => {
                        const next = { ...prev, ratePerHour: rate };
                        if (prev.items?.length && prev.items[0].description === 'Professional service') {
                          const qty = prev.items[0].quantity || 0;
                          next.items = [...prev.items];
                          next.items[0] = { ...next.items[0], rate: rate || 0, amount: qty * (rate || 0) };
                        }
                        return next;
                      });
                    }}
                    className="form-input"
                  />
                </div>
              </div>
              {invoice.hoursWorked != null && invoice.hoursWorked > 0 && (
                <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>Hours from check-in/out: {(invoice.hoursWorked ?? 0).toFixed(2)}</p>
              )}
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
                    value={item.quantity != null && Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1}
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
                    value={(item.amount ?? 0).toFixed(2)}
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
              <p style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
                Tax is applied to service charge. Travel costs are typically tax-exempt.
              </p>
            </div>
          </div>

          <div className="form-section">
            <div className="items-header">
              <h3 className="subsection-title">🚗 Travel costs</h3>
              <button
                type="button"
                onClick={loadTravelRecordsForPicker}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
              >
                <MapPin size={18} /> Select travel cost
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              Add travel costs from saved records, or calculate a new trip on the Travel page.
            </p>
            {showTravelPicker && (
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e0e0e0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Select from saved travel records</h4>
                {loadingTravelRecords ? (
                  <p style={{ color: '#666' }}>Loading...</p>
                ) : travelRecords.length === 0 ? (
                  <p style={{ color: '#666' }}>No travel records yet. Use Travel to calculate a trip and add to invoice.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {travelRecords.map((rec) => {
                      const id = `travel-rec-${rec.id}`;
                      const alreadyAdded = addedTravelIdsRef.current.has(id);
                      return (
                        <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'white', borderRadius: '6px', border: '1px solid #eee' }}>
                          <div>
                            <span style={{ fontWeight: '600' }}>{(rec.roundTripKm ?? rec.distanceKm * 2 ?? 0).toFixed(1)} km</span>
                            <span style={{ marginLeft: '8px', color: '#666' }}>{rec.travelDate}</span>
                            {(rec.origin || rec.destination) && (
                              <div style={{ fontSize: '12px', color: '#888' }}>{rec.origin} → {rec.destination}</div>
                            )}
                            {rec.totalCost != null && <span style={{ marginLeft: '8px', fontWeight: '500' }}>${Number(rec.totalCost).toFixed(2)}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => addTravelRecordToInvoice(rec)}
                            disabled={alreadyAdded}
                            style={{ padding: '6px 12px', background: alreadyAdded ? '#ccc' : '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: alreadyAdded ? 'default' : 'pointer', fontSize: '13px' }}
                          >
                            {alreadyAdded ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button type="button" onClick={() => setShowTravelPicker(false)} style={{ marginTop: '12px', fontSize: '13px', color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}>Close</button>
              </div>
            )}
            <button type="button" onClick={() => { saveDraft(); const d = sessionStorage.getItem(STORAGE_KEY); if (d) sessionStorage.setItem(DRAFT_BEFORE_TRAVEL_KEY, d); navigate('/travel'); }} style={{ padding: '8px 14px', background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              Calculate new travel →
            </button>
          </div>

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
                      Amount: ${(item.amount ?? 0).toFixed(2)}
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

          <div className="summary-box">
            <div className="summary-row">
              <span>Service charge (before tax):</span>
              <span className="summary-value">${calculateServiceCharge().toFixed(2)}</span>
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
                <span>🚗 Travel costs:</span>
                <span className="summary-value">${calculateTravelTotal().toFixed(2)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Full payment (total):</span>
              <span>${calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => setStep('signature')}
            disabled={!companyInfo || !invoice.customerName || !invoice.customerEmail}
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

      {step === 'delivery' && (
        <div className="form-container">
          <h2 className="section-title">Send invoice to customer</h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px', textAlign: 'center' }}>
            Choose how to deliver: manual (PDF/print) or share via email/link.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '800px', margin: '0 auto 24px' }}>
            <button
              onClick={() => handleDeliveryChoice('email')}
              disabled={isSaving}
              style={{
                padding: '40px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                fontSize: '18px',
                fontWeight: '600',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => !isSaving && (e.target.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              <Mail size={48} />
              <span>Send via Email</span>
              <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '400' }}>
                Opens email client with invoice details
              </span>
            </button>

            <button
              onClick={() => handleDeliveryChoice('manual')}
              disabled={isSaving}
              style={{
                padding: '40px',
                background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                fontSize: '18px',
                fontWeight: '600',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => !isSaving && (e.target.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              <FileCheck size={48} />
              <span>Present Manually</span>
              <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '400' }}>
                Save and download for manual delivery
              </span>
            </button>
          </div>

          <div style={{ maxWidth: '500px', margin: '0 auto 24px', padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>Client reminder</span>
            </label>
            {reminderEnabled && (
              <div style={{ marginLeft: '28px' }}>
                <label style={{ fontSize: '14px', color: '#555', marginBottom: '6px', display: 'block' }}>Reminder frequency</label>
                <select value={reminderFrequency} onChange={(e) => setReminderFrequency(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}>
                  <option value="15_after_accept">Every 15 days after customer accepts invoice</option>
                  <option value="15_before_due">Only 15 days before payment due date</option>
                </select>
              </div>
            )}
          </div>

          {isSaving && (
            <div style={{ textAlign: 'center', color: '#666' }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #e0e0e0',
                borderTopColor: '#667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              Saving invoice...
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button onClick={() => setStep('signature')} className="secondary-button">
              Back to Signature
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          {savedInvoiceId && (
            <div style={{
              background: '#d4edda',
              border: '2px solid #28a745',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle size={32} color="#28a745" />
              <div>
                <div style={{ fontWeight: '600', fontSize: '18px', marginBottom: '4px' }}>
                  Invoice Saved Successfully!
                </div>
                <div style={{ fontSize: '14px', color: '#155724' }}>
                  Invoice #{invoice.invoiceNumber} • 
                  Delivery: {deliveryMethod === 'email' ? '📧 Email' : '📄 Manual'} • 
                  Amount: ${calculateTotal().toFixed(2)}
                </div>
              </div>
            </div>
          )}

          <div id="invoice-preview" className="invoice-preview invoice-compact">
            {/* ✅ FEATURE 2 & 3: Redesigned Header */}
            <div 
              style={{
                backgroundColor: currentTemplate.bg,
                color: currentTemplate.text,
                padding: '32px',
                borderRadius: '8px 8px 0 0',
                textAlign: 'center',
                marginBottom: '32px'
              }}
            >
              <h1 style={{
                fontSize: '42px',
                fontWeight: '700',
                margin: '0 0 8px 0',
                letterSpacing: '-1px'
              }}>
                INVOICE
              </h1>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                opacity: 0.9
              }}>
                {invoice.invoiceNumber}
              </div>
            </div>

            {/* Company Info Below Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '32px',
              marginBottom: '32px',
              padding: '0 32px'
            }}>
              <div>
                {companyInfo?.logoUrl && (
                  <img src={companyInfo.logoUrl} alt="Logo" style={{ maxWidth: '150px', maxHeight: '80px', marginBottom: '16px' }} />
                )}
                <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>
                  {companyInfo?.legalBusinessName || companyInfo?.companyName}
                </div>
                {companyInfo?.operationalNameDba && (
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>DBA: {companyInfo.operationalNameDba}</div>
                )}
                {companyInfo?.companyAddress && (
                  <div style={{ fontSize: '14px', color: '#666', whiteSpace: 'pre-line', marginBottom: '4px' }}>
                    {companyInfo.companyAddress}
                  </div>
                )}
                {companyInfo?.gstNumber && (
                  <div style={{ fontSize: '14px', color: '#666' }}>HST/GST: {companyInfo.gstNumber}</div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                  BILL TO
                </div>
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                  {invoice.customerName}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                  {invoice.customerEmail}
                </div>
                {((invoice.payorName && invoice.payorName !== invoice.customerName) || (invoice.payorEmail && invoice.payorEmail !== invoice.customerEmail)) && (
                  <div style={{ fontSize: '13px', color: '#555', marginTop: '8px', padding: '8px', background: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '2px' }}>Payor</div>
                    {invoice.payorName && <div>{invoice.payorName}</div>}
                    {invoice.payorEmail && <div>{invoice.payorEmail}</div>}
                  </div>
                )}
                {invoice.serviceAddress && (
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                    Service Address:<br />
                    {invoice.serviceAddress}
                  </div>
                )}
                <div style={{ marginTop: '16px', fontSize: '14px' }}>
                  <div><strong>Date:</strong> {invoice.date}</div>
                  {invoice.dueDate && <div><strong>Due Date:</strong> {invoice.dueDate}</div>}
                </div>
              </div>
            </div>

            {servicePeriodVisits.length > 0 && (
              <div style={{ margin: '0 32px 16px', padding: '12px 16px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #1e3a5f', fontSize: '13px' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>Service period</div>
                {servicePeriodVisits.map((v, idx) => {
                  const line = formatVisitCheckTimes(v);
                  return line ? <div key={idx} style={{ marginBottom: idx < servicePeriodVisits.length - 1 ? '6px' : 0 }}>{line}</div> : null;
                })}
              </div>
            )}

            <table className="items-table" style={{ margin: '0 32px 24px' }}>
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
                    <td className="text-center">{item.quantity ?? 1}</td>
                    <td className="text-right">${(item.rate ?? 0).toFixed(2)}</td>
                    <td className="text-right item-amount">${(item.amount ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
                {(invoice.travelItems || []).map((item, index) => (
                  <tr key={`t-${index}`}>
                    <td>{item.description}</td>
                    <td className="text-center">{item.quantity ?? 1}</td>
                    <td className="text-right">{(item.rate ?? item.amount) != null ? `$${(item.rate ?? item.amount).toFixed(2)}` : '–'}</td>
                    <td className="text-right item-amount">${(item.amount ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '0 32px' }} className="invoice-footer">
              <div className="footer-left">
                {invoice.notes && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Notes</h3>
                    <div style={{ fontSize: '13px', color: '#666' }}>{invoice.notes}</div>
                  </div>
                )}
              </div>
              <div className="totals-box">
                <div className="total-row">
                  <span>Service charge (before tax):</span>
                  <span className="total-value">${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Tax ({invoice.taxRate}%):</span>
                  <span className="total-value">${calculateTax().toFixed(2)}</span>
                </div>
                
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
              <div className="signature-section-footer" style={{ margin: '32px 32px 0' }}>
                <div className="signature-label">Authorized Signature</div>
                <img src={signature} alt="Signature" className="signature-image" />
                <div className="signature-date">{new Date().toLocaleDateString()}</div>
              </div>
            )}
          </div>

          {/* ✅ FEATURE 8: Return to Dashboard Button */}
          <div className="action-buttons">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="secondary-button flex-button"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
            >
              <Home size={20} />
              Return to Dashboard
            </button>
            <button onClick={() => setStep('form')} className="secondary-button flex-button">
              Edit Invoice
            </button>
            <button onClick={downloadPDF} className="primary-button flex-button">
              <Download size={20} />
              Download PDF
            </button>
            {deliveryMethod === 'email' && (
              <button onClick={sendInvoice} className="success-button flex-button">
                <Send size={20} />
                Email Again
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default InvoiceGenerator;