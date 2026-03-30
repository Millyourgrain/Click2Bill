import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Trash2, Send, Home, Mail, FileCheck, CheckCircle, Calculator, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanyInfo } from '../../services/companyService';
import { getCustomer, getCustomers, upsertCustomerFromInvoice, findRecurringCustomerByName } from '../../services/customerService';
import { getVisit, getVisitHours, getVisitsHoursInRange } from '../../services/visitService';
import { saveInvoice, updateInvoice, getInvoice, generateInvoicePortalToken } from '../../services/invoiceService';
import { addTravelRecord, replaceTravelRecordsForInvoice } from '../../services/travelRecordService';
import { sendEmail } from '../../services/emailService';
import { formatInvoiceMoney, INVOICE_CURRENCY_OPTIONS, DEFAULT_INVOICE_CURRENCY, isCadCurrency, formatCadSalesTaxLabel } from '../../utils/invoiceCurrency';
import { downloadInvoicePdf, buildInvoiceSummaryHtml } from '../../utils/invoicePdf';
import InvoiceTravelGeoEstimate from './InvoiceTravelGeoEstimate';

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

function getInvoiceSignatoryPrintedName(companyInfo, currentUser) {
  const n = companyInfo?.eInvoiceIssuerName || companyInfo?.mcPrimaryUserFullLegalName;
  if (n && String(n).trim()) return String(n).trim();
  const u = currentUser?.displayName || currentUser?.email;
  return u ? String(u) : '';
}

function getInvoiceSignatoryTitle(companyInfo) {
  const sys = companyInfo?.invoiceSystem;
  const role = (companyInfo?.userTransactionRole || '').toLowerCase();
  if (sys === 'authorized_signatory') return 'Authorized signatory';
  if (role === 'maker') return 'Maker (issuer)';
  if (role === 'checker') return 'Checker (approver)';
  if (role === 'admin') return 'Administrator';
  return 'Authorized representative';
}

function formatInvoiceDateLong(isoYmd) {
  if (!isoYmd) return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const d = new Date(`${isoYmd}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? String(isoYmd)
    : d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function InvoiceGenerator({ travelCostItem: travelCostItemProp, onTravelCostConsumed }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const visitIdParam = searchParams.get('visitId');
  const customerIdParam = searchParams.get('customerId');
  const editInvoiceIdParam = searchParams.get('editInvoiceId');
  const { currentUser } = useAuth();

  const [step, setStep] = useState('form');
  const [headerTemplate, setHeaderTemplate] = useState('professional');
  const [companyInfo, setCompanyInfo] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState('15_before_due');
  const [isSaving, setIsSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState(null);
  /** When set, delivery updates this invoice (contested → revised resend) instead of creating a new doc. */
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

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
    currency: DEFAULT_INVOICE_CURRENCY,
    notes: '',
    taxRate: 13,
    hoursWorked: null,
    ratePerHour: null,
  });
  const [visitId, setVisitId] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [servicePeriodVisits, setServicePeriodVisits] = useState([]); // visits with check-in/out for invoice display

  const [signature, setSignature] = useState(null);
  /** ISO date (YYYY-MM-DD) when user authorized the signature; shown on preview/PDF. */
  const [signatorySignedAt, setSignatorySignedAt] = useState(null);
  /** Printed under signature; user-editable, default from org role. */
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [payorDifferentFromCustomer, setPayorDifferentFromCustomer] = useState(false);
  const [isRecurringCustomer, setIsRecurringCustomer] = useState(false);
  /** Mileage-only form (travel register, no invoice line). */
  const [showTravelDistancePanel, setShowTravelDistancePanel] = useState(false);
  const travelDistanceSectionRef = useRef(null);
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
        signatorySignedAt,
        signatoryTitle,
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
        if (!inv.currency) inv.currency = DEFAULT_INVOICE_CURRENCY;
        if (inv.manualTaxAmount == null || inv.manualTaxAmount === '') inv.manualTaxAmount = 0;
        setInvoice(inv);
      }
      if (draft.step) setStep(draft.step);
      if (draft.headerTemplate) setHeaderTemplate(draft.headerTemplate);
      if (draft.visitId) setVisitId(draft.visitId);
      if (draft.customerId) setCustomerId(draft.customerId);
      if (draft.payorDifferentFromCustomer != null) setPayorDifferentFromCustomer(!!draft.payorDifferentFromCustomer);
      if (draft.isRecurringCustomer != null) setIsRecurringCustomer(!!draft.isRecurringCustomer);
      if (draft.servicePeriodVisits?.length) setServicePeriodVisits(draft.servicePeriodVisits);
      if (draft.signature) setSignature(draft.signature);
      else setSignature(null);
      if (draft.signatorySignedAt != null) setSignatorySignedAt(draft.signatorySignedAt);
      else if (draft.signature && draft.invoice?.date) setSignatorySignedAt(draft.invoice.date);
      else if (!draft.signature) setSignatorySignedAt(null);
      if (draft.signatoryTitle != null) setSignatoryTitle(String(draft.signatoryTitle));
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
    const url = companyInfo?.logoUrl?.trim();
    if (!url) {
      setLogoDataUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error('logo fetch failed');
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (!cancelled) setLogoDataUrl(dataUrl);
      } catch (e) {
        console.warn('Invoice logo could not be inlined for PDF capture:', e);
        if (!cancelled) setLogoDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [companyInfo?.logoUrl]);

  useEffect(() => {
    if (loadingCompany || visitIdParam || customerIdParam || editInvoiceIdParam) return;
    const hadPendingTravel = !!sessionStorage.getItem(PENDING_TRAVEL_KEY);
    loadDraft();
    if (hadPendingTravel) setStep('form');
  }, [loadingCompany, visitIdParam, customerIdParam, editInvoiceIdParam]);

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
  }, [invoice, step, headerTemplate, visitId, customerId, payorDifferentFromCustomer, isRecurringCustomer, servicePeriodVisits, signature, signatorySignedAt, signatoryTitle, reminderEnabled, reminderFrequency, savedInvoiceId]);

  useEffect(() => {
    getCustomers().then((r) => r.success && setCustomers(r.data || []));
  }, []);

  /** Load a contested invoice for revise & resend (opened from dashboard). */
  useEffect(() => {
    if (!editInvoiceIdParam || loadingCompany) return;
    let cancelled = false;
    (async () => {
      const res = await getInvoice(editInvoiceIdParam);
      if (cancelled) return;
      if (!res.success) {
        alert(res.error || 'Could not load invoice');
        navigate('/dashboard', { replace: true });
        return;
      }
      const inv = res.data;
      if (inv.status !== 'contested') {
        alert('Only contested invoices can be revised and resent from here. Open it from the dashboard when status is "contested".');
        navigate('/dashboard', { replace: true });
        return;
      }
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) { /* ignore */ }
      setEditingInvoiceId(inv.id);
      setSavedInvoiceId(inv.id);
      const cur = inv.currency || DEFAULT_INVOICE_CURRENCY;
      setInvoice({
        invoiceNumber: inv.invoiceNumber,
        date: inv.date || new Date().toISOString().split('T')[0],
        dueDate: inv.dueDate || '',
        serviceStartDate: inv.serviceStartDate || '',
        serviceEndDate: inv.serviceEndDate || '',
        customerName: inv.customerName || '',
        customerEmail: inv.customerEmail || '',
        serviceAddress: inv.serviceAddress || '',
        payorName: inv.payorName || '',
        payorEmail: inv.payorEmail || '',
        items: Array.isArray(inv.items) && inv.items.length
          ? inv.items.map((it) => ({
              description: it.description || '',
              quantity: it.quantity ?? 1,
              rate: it.rate ?? 0,
              amount: it.amount ?? (Number(it.quantity || 1) * Number(it.rate || 0)),
            }))
          : [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        travelItems: inv.travelItems || [],
        currency: cur,
        notes: inv.notes || '',
        taxRate: inv.taxRate ?? 13,
        hoursWorked: inv.hoursWorked ?? null,
        ratePerHour: inv.ratePerHour ?? null,
        manualTaxAmount: isCadCurrency(cur) ? 0 : (inv.manualTaxAmount ?? inv.tax ?? 0),
      });
      setSignature(inv.signature || null);
      setSignatorySignedAt(inv.signatorySignedAt || inv.date || null);
      setSignatoryTitle((inv.signatoryTitle && String(inv.signatoryTitle).trim()) ? inv.signatoryTitle.trim() : getInvoiceSignatoryTitle(companyInfo));
      setServicePeriodVisits(inv.servicePeriodVisits || []);
      setVisitId(inv.visitId || null);
      setCustomerId(inv.customerId || null);
      setPayorDifferentFromCustomer(!!inv.isPayorDifferentFromCustomer);
      if (inv.headerTemplate) setHeaderTemplate(inv.headerTemplate);
      setStep('form');
    })();
    return () => { cancelled = true; };
  }, [editInvoiceIdParam, loadingCompany, navigate]);

  useEffect(() => {
    if (!isRecurringCustomer) return;
    const name = (invoice.customerName || '').trim();
    if (name.length < 2) return;
    const t = setTimeout(() => {
      findRecurringCustomerByName(name).then((r) => {
        if (!r.success || !r.data) return;
        const c = r.data;
        setCustomerId(c.id);
        const payorDiff = c.isPayorSameAsCustomer === false;
        setPayorDifferentFromCustomer(payorDiff);
        setInvoice((prev) => ({
          ...prev,
          customerEmail: c.customerEmail || prev.customerEmail,
          serviceAddress: c.serviceAddress ?? prev.serviceAddress,
          payorName: payorDiff ? (c.payorName || '') : '',
          payorEmail: payorDiff ? (c.payorEmail || '') : '',
        }));
      });
    }, 450);
    return () => clearTimeout(t);
  }, [invoice.customerName, isRecurringCustomer]);

  const goToTravelForBilling = () => {
    saveDraft();
    try {
      const d = sessionStorage.getItem(STORAGE_KEY);
      if (d) sessionStorage.setItem(DRAFT_BEFORE_TRAVEL_KEY, d);
    } catch (e) { /* ignore */ }
    navigate('/travel');
  };

  useEffect(() => {
    if (!showTravelDistancePanel || !travelDistanceSectionRef.current) return;
    const t = requestAnimationFrame(() => {
      travelDistanceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(t);
  }, [showTravelDistancePanel]);

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
          const payorDiff = c.isPayorSameAsCustomer === false;
          setPayorDifferentFromCustomer(payorDiff);
          setIsRecurringCustomer(!!c.isRecurring);
          setInvoice((prev) => ({
            ...prev,
            customerName: c.customerName || prev.customerName,
            customerEmail: c.customerEmail || prev.customerEmail,
            customerPhone: c.customerPhone,
            serviceAddress: c.serviceAddress || prev.serviceAddress,
            payorName: payorDiff ? (c.payorName || prev.payorName || '') : '',
            payorEmail: payorDiff ? (c.payorEmail || c.customerEmail) : '',
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
    if (isCadCurrency(invoice.currency)) {
      return calculateSubtotal() * (invoice.taxRate / 100);
    }
    return Math.max(0, parseFloat(invoice.manualTaxAmount) || 0);
  };

  const calculateTravelTotal = () => {
    return invoice.travelItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

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
    setSignatorySignedAt(null);
  };

  const saveSignature = () => {
    const canvas = signatureRef.current;
    setSignature(canvas.toDataURL());
    setSignatorySignedAt(new Date().toISOString().split('T')[0]);
    setStep('preview');
  };

  useEffect(() => {
    if (step !== 'signature' || !signature) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = signature;
  }, [step, signature]);

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
        isPayorDifferentFromCustomer: payorDifferentFromCustomer,
        payorName: payorDifferentFromCustomer ? (invoice.payorName || '') : '',
        payorEmail: payorDifferentFromCustomer ? (invoice.payorEmail || '') : invoice.customerEmail,
        items: invoice.items,
        travelItems: invoice.travelItems,
        hoursWorked: invoice.hoursWorked,
        ratePerHour: invoice.ratePerHour,
        subtotal: calculateSubtotal(),
        taxRate: isCadCurrency(invoice.currency) ? invoice.taxRate : 0,
        tax: calculateTax(),
        travelTotal: calculateTravelTotal(),
        total: calculateTotal(),
        currency: invoice.currency || DEFAULT_INVOICE_CURRENCY,
        manualTaxAmount: isCadCurrency(invoice.currency) ? null : (parseFloat(invoice.manualTaxAmount) || 0),
        notes: invoice.notes,
        signature: signature,
        signatoryTitle: (signatoryTitle && String(signatoryTitle).trim()) || getInvoiceSignatoryTitle(companyInfo),
        signatoryPrintedName: getInvoiceSignatoryPrintedName(companyInfo, currentUser),
        signatorySignedAt: signatorySignedAt || invoice.date || null,
        portalToken: status === 'sent' ? generateInvoicePortalToken() : null,
        issuerPaymentEmail: companyInfo?.email || '',
        bankTransitNumber: companyInfo?.bankTransitNumber || '',
        bankInstitutionNumber: companyInfo?.bankInstitutionNumber || '',
        bankAccountNumber: companyInfo?.bankAccountNumber || '',
        headerTemplate: headerTemplate,
        status: status,
        deliveryMethod: method,
        reminderEnabled: method ? reminderEnabled : false,
        reminderFrequency: method ? reminderFrequency : null,
        issuedAt: status === 'sent' ? new Date().toISOString() : null,
      };
      const result = await saveInvoice(invoiceData);
      
      if (result.success) {
        const upsert = await upsertCustomerFromInvoice({
          billingCustomerId: customerId,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          serviceAddress: invoice.serviceAddress,
          payorDifferentFromCustomer,
          payorName: invoice.payorName,
          payorEmail: invoice.payorEmail,
          isRecurringCustomer,
        });
        if (upsert.success && upsert.data?.id) {
          if (upsert.data.id !== customerId) setCustomerId(upsert.data.id);
          await updateInvoice(result.data.id, { customerId: upsert.data.id });
          getCustomers().then((r) => r.success && setCustomers(r.data || []));
        } else if (upsert.error && upsert.error !== 'Customer name and email required') {
          console.warn('Customer upsert:', upsert.error);
        }
        await replaceTravelRecordsForInvoice(result.data.id, invoice.invoiceNumber, invoice.travelItems).catch((e) =>
          console.warn('Travel register sync:', e)
        );
        setSavedInvoiceId(result.data.id);
        return result.data.id;
      } else {
        alert('Failed to save invoice: ' + result.error);
        return null;
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save invoice');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  /** Persist changes to a contested invoice and reset customer review state for resend. */
  const handleUpdateContestInvoice = async (method) => {
    if (!editingInvoiceId) return false;
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
        isPayorDifferentFromCustomer: payorDifferentFromCustomer,
        payorName: payorDifferentFromCustomer ? (invoice.payorName || '') : '',
        payorEmail: payorDifferentFromCustomer ? (invoice.payorEmail || '') : invoice.customerEmail,
        items: invoice.items,
        travelItems: invoice.travelItems,
        hoursWorked: invoice.hoursWorked,
        ratePerHour: invoice.ratePerHour,
        subtotal: calculateSubtotal(),
        taxRate: isCadCurrency(invoice.currency) ? invoice.taxRate : 0,
        tax: calculateTax(),
        travelTotal: calculateTravelTotal(),
        total: calculateTotal(),
        currency: invoice.currency || DEFAULT_INVOICE_CURRENCY,
        manualTaxAmount: isCadCurrency(invoice.currency) ? null : (parseFloat(invoice.manualTaxAmount) || 0),
        notes: invoice.notes,
        signature,
        signatoryTitle: (signatoryTitle && String(signatoryTitle).trim()) || getInvoiceSignatoryTitle(companyInfo),
        signatoryPrintedName: getInvoiceSignatoryPrintedName(companyInfo, currentUser),
        portalToken: generateInvoicePortalToken(),
        issuerPaymentEmail: companyInfo?.email || '',
        bankTransitNumber: companyInfo?.bankTransitNumber || '',
        bankInstitutionNumber: companyInfo?.bankInstitutionNumber || '',
        bankAccountNumber: companyInfo?.bankAccountNumber || '',
        headerTemplate,
        status: 'sent',
        customerCommentary: null,
        viewedAt: null,
        acceptedAt: null,
        paidAt: null,
        paymentReference: null,
        deliveryMethod: method,
        reminderEnabled: method ? reminderEnabled : false,
        reminderFrequency: method ? reminderFrequency : null,
        issuedAt: new Date().toISOString(),
      };
      const result = await updateInvoice(editingInvoiceId, invoiceData);
      if (!result.success) {
        alert('Failed to update invoice: ' + result.error);
        return false;
      }
      await replaceTravelRecordsForInvoice(editingInvoiceId, invoice.invoiceNumber, invoice.travelItems);
      const upsert = await upsertCustomerFromInvoice({
        billingCustomerId: customerId,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        serviceAddress: invoice.serviceAddress,
        payorDifferentFromCustomer,
        payorName: invoice.payorName,
        payorEmail: invoice.payorEmail,
        isRecurringCustomer,
      });
      if (upsert.success && upsert.data?.id) {
        if (upsert.data.id !== customerId) setCustomerId(upsert.data.id);
        await updateInvoice(editingInvoiceId, { customerId: upsert.data.id });
        getCustomers().then((r) => r.success && setCustomers(r.data || []));
      }
      setSavedInvoiceId(editingInvoiceId);
      setEditingInvoiceId(null);
      return true;
    } catch (e) {
      console.error(e);
      alert('Failed to update invoice');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Delivery: save invoice first, then email (portal link) and/or show preview + PDF — same sequence as reference (deliver before preview).
  const handleDeliveryChoice = async (method) => {
    setDeliveryMethod(method);
    const pdfCompanyInfo = companyInfo
      ? {
          ...companyInfo,
          email: companyInfo.email || '',
          bankTransitNumber: companyInfo.bankTransitNumber || '',
          bankInstitutionNumber: companyInfo.bankInstitutionNumber || '',
          bankAccountNumber: companyInfo.bankAccountNumber || '',
        }
      : companyInfo;
    const pdfProps = {
      invoice,
      companyInfo: pdfCompanyInfo,
      subtotal: calculateSubtotal(),
      tax: calculateTax(),
      travelTotal: calculateTravelTotal(),
      total: calculateTotal(),
    };
    const runAfterPreviewPaint = (fn) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(fn, 120);
        });
      });
    };

    if (editingInvoiceId) {
      const docIdForResend = editingInvoiceId;
      const ok = await handleUpdateContestInvoice(method);
      if (!ok) return;
      if (method === 'email') {
        await sendInvoice(docIdForResend, pdfProps);
        navigate('/invoice', { replace: true });
        return;
      }
      setStep('preview');
      runAfterPreviewPaint(() => {
        downloadInvoicePdf({
          ...pdfProps,
          previewEl: document.getElementById('invoice-preview'),
        });
      });
      return;
    }

    const newInvoiceId = await handleSaveInvoice('sent', method);
    if (!newInvoiceId) return;

    if (method === 'email') {
      await sendInvoice(newInvoiceId, pdfProps);
    }
    setStep('preview');
    if (method === 'manual') {
      runAfterPreviewPaint(() => {
        downloadInvoicePdf({
          ...pdfProps,
          previewEl: document.getElementById('invoice-preview'),
        });
      });
    }
  };

  const downloadPDF = () => {
    const pdfCompanyInfo = companyInfo
      ? {
          ...companyInfo,
          email: companyInfo.email || '',
          bankTransitNumber: companyInfo.bankTransitNumber || '',
          bankInstitutionNumber: companyInfo.bankInstitutionNumber || '',
          bankAccountNumber: companyInfo.bankAccountNumber || '',
        }
      : companyInfo;
    downloadInvoicePdf({
      invoice,
      companyInfo: pdfCompanyInfo,
      subtotal: calculateSubtotal(),
      tax: calculateTax(),
      travelTotal: calculateTravelTotal(),
      total: calculateTotal(),
      previewEl: document.getElementById('invoice-preview'),
    });
  };

  const sendInvoice = async (invoiceDocId, pdfProps) => {
    const emailTo = invoice.payorEmail || invoice.customerEmail;
    if (!emailTo) {
      alert('No customer or payor email on the invoice.');
      return;
    }
    const id = invoiceDocId || savedInvoiceId;
    const props = pdfProps || {
      invoice,
      companyInfo,
      subtotal: calculateSubtotal(),
      tax: calculateTax(),
      travelTotal: calculateTravelTotal(),
      total: calculateTotal(),
    };
    setSendingEmail(true);
    const subject = `Invoice ${invoice.invoiceNumber} from ${companyInfo?.companyName || 'Your Company'}`;
    let invoiceLink = '';
    if (id) {
      const invSnap = await getInvoice(id);
      if (!invSnap.success) {
        setSendingEmail(false);
        alert(invSnap.error || 'Could not prepare the customer link.');
        return;
      }
      let portalToken = invSnap.data?.portalToken || null;
      if (!portalToken) {
        portalToken = generateInvoicePortalToken();
        await updateInvoice(id, { portalToken });
      }
      invoiceLink = `${window.location.origin}/invoice/view/${id}?t=${encodeURIComponent(portalToken)}`;
    }
    const supplier = companyInfo?.companyName || companyInfo?.legalBusinessName || 'Your supplier';
    const text = `Dear ${invoice.customerName},\n\nInvoice ${invoice.invoiceNumber} is ready from ${supplier}.\n\nTotal: ${formatInvoiceMoney(props.total, invoice.currency)}\n\nOpen your invoice (no account required — accept, contest, or download):\n${invoiceLink || '(link unavailable)'}\n\nThank you,\n${supplier}`;
    const html = buildInvoiceSummaryHtml({
      invoice,
      companyInfo,
      subtotal: props.subtotal,
      tax: props.tax,
      travelTotal: props.travelTotal,
      total: props.total,
      invoiceLink,
      linkOnly: true,
    });
    const res = await sendEmail({ to: emailTo, subject, text, html });
    setSendingEmail(false);
    if (res.success) alert('Invoice sent successfully!');
    else alert(res.error || 'Failed to send email.');
  };

  const currentTemplate = headerTemplates[headerTemplate];
  const showDeliverOnPreview = !savedInvoiceId || !!editingInvoiceId;

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
        {[
          { id: 'form', label: 'Form' },
          { id: 'signature', label: 'Signing' },
          { id: 'preview', label: 'Preview' },
          { id: 'delivery', label: 'Deliver' },
        ].map(({ id: s, label }, idx) => (
          <div key={s} className="step-item">
            <div className={`step-number ${step === s ? 'active' : ''}`}>
              {idx + 1}
            </div>
            <span className={`step-label ${step === s ? 'active' : ''}`}>
              {label}
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
                          const payorDiff = c.isPayorSameAsCustomer === false;
                          setPayorDifferentFromCustomer(payorDiff);
                          setIsRecurringCustomer(!!c.isRecurring);
                          setInvoice((prev) => ({
                            ...prev,
                            customerName: c.customerName || prev.customerName,
                            customerEmail: c.customerEmail || prev.customerEmail,
                            customerPhone: c.customerPhone,
                            serviceAddress: c.serviceAddress || prev.serviceAddress,
                            payorName: payorDiff ? (c.payorName || prev.payorName || '') : '',
                            payorEmail: payorDiff ? (c.payorEmail || c.customerEmail) : '',
                          }));
                        }
                      });
                    } else {
                      setPayorDifferentFromCustomer(false);
                      setIsRecurringCustomer(false);
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={isRecurringCustomer}
                onChange={(e) => setIsRecurringCustomer(e.target.checked)}
              />
              <span><strong>Recurring customer</strong> — save details for this name so a future invoice can auto-fill email, address, and payor after you enter the same name.</span>
            </label>
            <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: payorDifferentFromCustomer ? '14px' : 0 }}>
                <input
                  type="checkbox"
                  checked={payorDifferentFromCustomer}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setPayorDifferentFromCustomer(on);
                    if (!on) {
                      setInvoice((prev) => ({ ...prev, payorName: '', payorEmail: '' }));
                    }
                  }}
                  style={{ marginTop: '3px' }}
                />
                <span style={{ fontSize: '14px', lineHeight: 1.45 }}><strong>Payor is different from the customer</strong> — enable only when the person or organization paying the invoice is not the customer named above.</span>
              </label>
              {payorDifferentFromCustomer && (
                <>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#555' }}>Payor (billing contact)</div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Payor name *</label>
                      <input
                        type="text"
                        value={invoice.payorName || ''}
                        onChange={(e) => setInvoice({ ...invoice, payorName: e.target.value })}
                        className="form-input"
                        placeholder="Legal or billing name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payor email *</label>
                      <input
                        type="email"
                        value={invoice.payorEmail || ''}
                        onChange={(e) => setInvoice({ ...invoice, payorEmail: e.target.value })}
                        className="form-input"
                        placeholder="Where we send the invoice"
                      />
                    </div>
                  </div>
                </>
              )}
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
            <div style={{ marginBottom: '20px', maxWidth: '320px' }}>
              <label className="form-label">Invoice currency</label>
              <select
                className="form-input"
                value={invoice.currency || DEFAULT_INVOICE_CURRENCY}
                onChange={(e) => {
                  const c = e.target.value;
                  setInvoice((prev) => ({
                    ...prev,
                    currency: c,
                    taxRate: isCadCurrency(c) ? (prev.taxRate > 0 ? prev.taxRate : 13) : 0,
                    manualTaxAmount: isCadCurrency(c) ? 0 : prev.manualTaxAmount,
                  }));
                }}
              >
                {INVOICE_CURRENCY_OPTIONS.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
              <p style={{ fontSize: '13px', color: '#666', marginTop: '6px', marginBottom: 0 }}>
                All line amounts and totals use this currency. More currencies can be added later.
              </p>
            </div>
            {invoice.hoursWorked != null && invoice.hoursWorked > 0 && (
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>Hours from linked visits (check-in/out): {(invoice.hoursWorked ?? 0).toFixed(2)}</p>
            )}
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
                  <label className="form-label">Rate ({invoice.currency || DEFAULT_INVOICE_CURRENCY})</label>
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
                  <label className="form-label">Amount ({invoice.currency || DEFAULT_INVOICE_CURRENCY})</label>
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
            {isCadCurrency(invoice.currency) ? (
              <div className="form-group">
                <label className="form-label">Tax rate (%)</label>
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
            ) : (
              <>
                <div style={{ padding: '14px', background: '#fff8e1', border: '1px solid #ffc107', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', lineHeight: 1.5, color: '#5d4037' }}>
                  <strong>Export / non-CAD billing:</strong> Assuming goods and services are exported and hence are not subject to Canadian GST/HST. The tax rate is set to <strong>0%</strong>. If you need to collect another jurisdiction&apos;s tax, enter it manually below.
                </div>
                <div className="form-group">
                  <label className="form-label">Tax rate (%)</label>
                  <input type="number" value={0} readOnly className="form-input tax-input readonly" style={{ background: '#f5f5f5' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Manual tax amount ({invoice.currency})</label>
                  <input
                    type="number"
                    value={invoice.manualTaxAmount === '' ? '' : invoice.manualTaxAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInvoice({
                        ...invoice,
                        manualTaxAmount: v === '' ? '' : Math.max(0, parseFloat(v) || 0),
                      });
                    }}
                    min="0"
                    step="0.01"
                    className="form-input tax-input"
                    placeholder="0 — optional"
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-section">
            <h3 className="subsection-title">Travel (optional)</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px', lineHeight: 1.5 }}>
              Choose whether to bill estimated travel on this invoice or only log kilometres in your travel register.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              <div>
                <button
                  type="button"
                  onClick={goToTravelForBilling}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-700) 100%)',
                    color: 'white',
                    border: '1px solid var(--gold)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <Calculator size={18} aria-hidden /> Add travel cost
                </button>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 0', lineHeight: 1.5 }}>
                  Opens the <strong>travel cost estimator</strong>. After you calculate a trip, use <strong>Add to invoice</strong> there to add the line to this invoice and save distance and cost in your travel register.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  aria-expanded={showTravelDistancePanel}
                  onClick={() => setShowTravelDistancePanel((open) => !open)}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    background: showTravelDistancePanel ? '#e0f2fe' : 'white',
                    color: '#0c4a6e',
                    border: showTravelDistancePanel ? '2px solid #0284c7' : '2px solid #bae6fd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <MapPin size={18} aria-hidden /> Record the travel distance
                </button>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 0', lineHeight: 1.5 }}>
                  Log one-way or round-trip distance only. Saved to your <strong>travel register</strong> — not added to this invoice total.
                </p>
              </div>
            </div>
            {showTravelDistancePanel && (
              <div ref={travelDistanceSectionRef}>
                <InvoiceTravelGeoEstimate
                  invoiceNumber={invoice.invoiceNumber}
                  invoiceId={savedInvoiceId}
                  travelDate={invoice.date}
                />
              </div>
            )}
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
                      Amount: {formatInvoiceMoney(item.amount ?? 0, invoice.currency)}
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
              <span className="summary-value">{formatInvoiceMoney(calculateServiceCharge(), invoice.currency)}</span>
            </div>
            <div className="summary-row">
              <span>{isCadCurrency(invoice.currency) ? `${formatCadSalesTaxLabel(invoice.taxRate)}:` : 'Tax (manual):'}</span>
              <span className="summary-value">{formatInvoiceMoney(calculateTax(), invoice.currency)}</span>
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
                <span className="summary-value">{formatInvoiceMoney(calculateTravelTotal(), invoice.currency)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Full payment (total):</span>
              <span>{formatInvoiceMoney(calculateTotal(), invoice.currency)}</span>
            </div>
          </div>

          <button
            onClick={() => setStep('signature')}
            disabled={
              !companyInfo
              || !invoice.customerName
              || !invoice.customerEmail
              || (payorDifferentFromCustomer && (!invoice.payorName?.trim() || !invoice.payorEmail?.trim()))
            }
            className="continue-button"
          >
            Continue to signing
          </button>
        </div>
      )}

      {step === 'signature' && (
        <div className="form-container">
          <h2 className="section-title">Signing</h2>
          <p className="signature-description">
            Please sign below to authorize this invoice. Next you&apos;ll preview the invoice, then choose how to deliver it.
          </p>

          <div className="form-section" style={{ maxWidth: '800px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Title (printed under your name)</label>
              <input
                type="text"
                className="form-input"
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                placeholder={companyInfo ? getInvoiceSignatoryTitle(companyInfo) : 'e.g. Authorized signatory'}
              />
            </div>
          </div>

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
              Back to form
            </button>
            <button onClick={saveSignature} className="primary-button">
              Save &amp; continue to preview
            </button>
          </div>
        </div>
      )}

      {step === 'delivery' && (
        <div className="form-container">
          <h2 className="section-title">{editingInvoiceId ? 'Resend revised invoice' : 'Send invoice to customer'}</h2>
          {editingInvoiceId && (
            <p style={{ fontSize: '15px', color: '#155724', marginBottom: '20px', textAlign: 'center', padding: '12px', background: '#d4edda', borderRadius: '8px', maxWidth: '640px', margin: '12px auto 20px' }}>
              You are resending after a contest. Customer feedback will be cleared when you confirm; they can accept or contest this revision again.
            </p>
          )}
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px', textAlign: 'center' }}>
            Email sends a <strong>secure link</strong> so the customer can accept (and download a PDF) or contest with a comment. You can also save and print a PDF for hand delivery.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '800px', margin: '0 auto 24px' }}>
            <button
              onClick={() => handleDeliveryChoice('email')}
              disabled={isSaving}
              style={{
                padding: '40px',
                background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-700) 100%)',
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
              <span>Send link by email</span>
              <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '400' }}>
                No PDF attachment — customer opens the invoice online
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
                borderTopColor: 'var(--gold)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              Saving invoice...
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="secondary-button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Home size={20} aria-hidden />
              Back to dashboard
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Preview</h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '20px', fontSize: '15px', lineHeight: 1.5, maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
            {savedInvoiceId
              ? 'Your invoice has been saved. You can return to the dashboard, download a PDF, or send the customer link again by email.'
              : 'Check layout, signature, and totals. Use the actions below to edit, download a PDF, or continue to delivery.'}
          </p>

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
                  Amount: {formatInvoiceMoney(calculateTotal(), invoice.currency)}
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
                marginBottom: '0'
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
                color: '#333'
              }}
            >
              <div><strong>Date:</strong> {invoice.date}</div>
              {invoice.dueDate && (
                <div><strong>Due date:</strong> {invoice.dueDate}</div>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <strong>Currency:</strong> {invoice.currency || DEFAULT_INVOICE_CURRENCY}
              </div>
            </div>

            {/* Company (left) and bill-to (right), top-aligned */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '32px',
              marginBottom: '32px',
              padding: '0 32px',
              alignItems: 'start'
            }}>
              <div style={{ alignSelf: 'start' }}>
                {(logoDataUrl || companyInfo?.logoUrl) && (
                  <img
                    src={logoDataUrl || companyInfo.logoUrl}
                    alt=""
                    className="invoice-preview-logo"
                    style={{ maxWidth: '150px', maxHeight: '80px', marginBottom: '16px', display: 'block', objectFit: 'contain' }}
                  />
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
                  <div style={{ fontSize: '14px', color: '#666' }}>HST/GST No.: {companyInfo.gstNumber}</div>
                )}
                {companyInfo?.bnNumber && (
                  <div style={{ fontSize: '14px', color: '#666' }}>Business no. (BN): {companyInfo.bnNumber}</div>
                )}
              </div>

              <div style={{ textAlign: 'right', alignSelf: 'start' }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.06em' }}>
                  BILL TO
                </div>
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                  {invoice.customerName}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                  {invoice.customerEmail}
                </div>
                {payorDifferentFromCustomer && (invoice.payorName || invoice.payorEmail) && (
                  <div style={{ fontSize: '13px', color: '#555', marginTop: '8px', padding: '8px', background: '#f8f9fa', borderRadius: '6px', textAlign: 'left' }}>
                    <div style={{ fontWeight: '600', marginBottom: '2px' }}>Payor</div>
                    {invoice.payorName && <div>{invoice.payorName}</div>}
                    {invoice.payorEmail && <div>{invoice.payorEmail}</div>}
                  </div>
                )}
                {invoice.serviceAddress && (
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                    Service address:<br />
                    {invoice.serviceAddress}
                  </div>
                )}
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

            <table className="items-table items-table-invoice" style={{ margin: '0 32px 24px' }}>
              <thead>
                <tr>
                  <th className="col-description">Description</th>
                  <th className="text-right col-qty">Quantity</th>
                  <th className="text-right col-rate">Rate</th>
                  <th className="text-right col-amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td className="col-description">{item.description}</td>
                    <td className="text-right col-qty">{item.quantity ?? 1}</td>
                    <td className="text-right col-rate">{formatInvoiceMoney(item.rate ?? 0, invoice.currency)}</td>
                    <td className="text-right item-amount col-amount">{formatInvoiceMoney(item.amount ?? 0, invoice.currency)}</td>
                  </tr>
                ))}
                {(invoice.travelItems || []).map((item, index) => (
                  <tr key={`t-${index}`}>
                    <td className="col-description">{item.description}</td>
                    <td className="text-right col-qty">{item.quantity ?? 1}</td>
                    <td className="text-right col-rate">{(item.rate ?? item.amount) != null ? formatInvoiceMoney(item.rate ?? item.amount, invoice.currency) : '–'}</td>
                    <td className="text-right item-amount col-amount">{formatInvoiceMoney(item.amount ?? 0, invoice.currency)}</td>
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
                  <span className="total-value">{formatInvoiceMoney(calculateSubtotal(), invoice.currency)}</span>
                </div>
                <div className="total-row">
                  <span>{isCadCurrency(invoice.currency) ? `${formatCadSalesTaxLabel(invoice.taxRate)}:` : 'Tax (manual):'}</span>
                  <span className="total-value">{formatInvoiceMoney(calculateTax(), invoice.currency)}</span>
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
                      {formatInvoiceMoney(calculateTravelTotal(), invoice.currency)}
                    </span>
                  </div>
                )}
                
                <div className="total-row grand-total">
                  <span>Total:</span>
                  <span>{formatInvoiceMoney(calculateTotal(), invoice.currency)}</span>
                </div>
              </div>
            </div>

            {signature && (
              <div
                className="signature-section-footer"
                style={{
                  margin: '24px 32px 0',
                  paddingBottom: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e9ecef',
                  borderRadius: '0 0 8px 8px',
                }}
              >
                <div className="signature-label">Authorized signature</div>
                <img src={signature} alt="" className="signature-image" />
                <div className="signature-printed-lines" style={{ marginTop: '14px', fontSize: '13px', color: '#212529', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: '600' }}>{getInvoiceSignatoryPrintedName(companyInfo, currentUser)}</div>
                  <div style={{ color: '#495057' }}>{(signatoryTitle && String(signatoryTitle).trim()) || getInvoiceSignatoryTitle(companyInfo)}</div>
                  <div style={{ color: '#495057' }}>
                    Date signed: {formatInvoiceDateLong(signatorySignedAt || invoice.date)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="action-buttons preview-actions-bar"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxWidth: '720px',
              margin: '28px auto 0',
              padding: '0 16px',
            }}
          >
            {savedInvoiceId ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="secondary-button flex-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <Home size={20} aria-hidden />
                  Return to Dashboard
                </button>
                <button
                  type="button"
                  onClick={downloadPDF}
                  className="primary-button flex-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <Download size={20} aria-hidden />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => sendInvoice(savedInvoiceId, {
                    invoice,
                    companyInfo,
                    subtotal: calculateSubtotal(),
                    tax: calculateTax(),
                    travelTotal: calculateTravelTotal(),
                    total: calculateTotal(),
                  })}
                  disabled={sendingEmail}
                  className="success-button flex-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <Send size={20} aria-hidden />
                  {sendingEmail ? 'Sending…' : 'Email again'}
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                }}
              >
                <button type="button" onClick={() => setStep('form')} className="secondary-button flex-button">
                  Edit invoice
                </button>
                <button
                  type="button"
                  onClick={downloadPDF}
                  className="primary-button flex-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <Download size={20} aria-hidden />
                  Download PDF
                </button>
                {showDeliverOnPreview && (
                  <button
                    type="button"
                    onClick={() => setStep('delivery')}
                    className="success-button flex-button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                  >
                    <FileCheck size={20} aria-hidden />
                    Deliver
                  </button>
                )}
              </div>
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