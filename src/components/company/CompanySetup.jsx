import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { saveCompanyInfo, getOwnCompanyDocument, uploadBinaryForSetup } from '../../services/companyService';
import { sendEmail } from '../../services/emailService';
import { useAuth } from '../../contexts/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BUSINESS_STRUCTURES = [
  'Sole proprietorship',
  'Corporation',
  'Partnership',
  'Non-Profit',
];

const INVOICE_SYSTEM = {
  AUTH: 'authorized_signatory',
  MC: 'maker_checker',
};

const TRANSACTION_ROLE = {
  AUTH: 'authorized_signatory',
  ADMIN: 'admin',
  MAKER: 'maker',
  CHECKER: 'checker',
};

const VERIFICATION_DOCS = [
  { field: 'verifyDocArticlesUrl', label: 'Articles of Incorporation' },
  { field: 'verifyDocGstHstUrl', label: 'GST/HST registration confirmation' },
  { field: 'verifyDocBankStatementUrl', label: 'Bank account statement' },
  { field: 'verifyDocObrUrl', label: 'OBR Certificate of Status' },
  { field: 'verifyDocCraBnUrl', label: 'CRA Business Number confirmation letter' },
];

/** Permission rows: create, edit, approve, send, view, manage */
const PERMISSION_MATRIX = {
  auth: [true, true, true, true, true, true],
  admin: [true, true, true, true, true, true],
  maker: [true, true, false, false, true, false],
  checker: [false, false, true, true, true, false],
};

const PERMISSION_LABELS = [
  'Create invoice',
  'Edit invoice',
  'Approve invoice',
  'Send invoice',
  'View all invoices',
  'Manage users',
];

/** Four screens; section numbers run 1–14 in flow order (no gaps). */
const WIZARD_PAGE_COUNT = 4;
const WIZARD_POINT_LABELS = ['1–3', '4–6', '7–10', '11–14'];

function wizardPointRange(pageIndex) {
  return WIZARD_POINT_LABELS[pageIndex] ?? '';
}

function Section({ num, title, children }) {
  return (
    <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#333' }}>
        <span style={{ color: 'var(--gold-dark)', marginRight: '8px' }}>{num}.</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function PermissionsTableByModel({ invoiceSystem, userTransactionRole }) {
  const baseCell = { border: '1px solid #e0e0e0', padding: '10px', textAlign: 'center', verticalAlign: 'middle' };
  const cellLeft = { ...baseCell, textAlign: 'left' };

  const tick = (allowed) => (
    <span style={{ color: allowed ? '#16a34a' : '#9ca3af', fontWeight: allowed ? 700 : 400, fontSize: '16px' }}>
      {allowed ? '✓' : '—'}
    </span>
  );

  const headerBg = (highlight) => ({
    ...baseCell,
    background: highlight ? '#ecfdf5' : '#f8f9fa',
    fontWeight: 600,
    borderBottom: highlight ? '2px solid #16a34a' : undefined,
  });

  if (!invoiceSystem) {
    return (
      <p style={{ fontSize: '14px', color: '#888', marginBottom: 0 }}>
        Select an invoicing model above to see the permissions that apply for your organization.
      </p>
    );
  }

  if (invoiceSystem === INVOICE_SYSTEM.AUTH) {
    const vals = PERMISSION_MATRIX.auth;
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={headerBg(false)}>Permission</th>
              <th style={headerBg(true)}>Authorized signatory</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_LABELS.map((label, i) => (
              <tr key={label}>
                <td style={cellLeft}>{label}</td>
                <td style={{ ...baseCell, background: 'rgba(22, 163, 74, 0.08)' }}>{tick(vals[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '12px', marginBottom: 0 }}>
          Maker and checker roles do not apply when you use the authorized signatory model.
        </p>
      </div>
    );
  }

  if (invoiceSystem === INVOICE_SYSTEM.MC) {
    const admin = PERMISSION_MATRIX.admin;
    const maker = PERMISSION_MATRIX.maker;
    const checker = PERMISSION_MATRIX.checker;
    const hlAdmin = userTransactionRole === TRANSACTION_ROLE.ADMIN;
    const hlMaker = userTransactionRole === TRANSACTION_ROLE.MAKER;
    const hlChecker = userTransactionRole === TRANSACTION_ROLE.CHECKER;
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={headerBg(false)}>Permission</th>
              <th style={headerBg(hlAdmin)}>Admin</th>
              <th style={headerBg(hlMaker)}>Maker (issuer)</th>
              <th style={headerBg(hlChecker)}>Checker (approver)</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_LABELS.map((label, i) => (
              <tr key={label}>
                <td style={cellLeft}>{label}</td>
                <td style={{ ...baseCell, background: hlAdmin ? 'rgba(22, 163, 74, 0.08)' : undefined }}>
                  {tick(admin[i])}
                </td>
                <td style={{ ...baseCell, background: hlMaker ? 'rgba(22, 163, 74, 0.08)' : undefined }}>
                  {tick(maker[i])}
                </td>
                <td style={{ ...baseCell, background: hlChecker ? 'rgba(22, 163, 74, 0.08)' : undefined }}>
                  {tick(checker[i])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '12px', marginBottom: 0 }}>
          After you choose your personal role in section 9, that column is highlighted. In section 10 you invite two people and assign each a sign-up role — exactly one Maker and one Checker.
        </p>
      </div>
    );
  }

  return null;
}

function acknowledgementCopy(role) {
  switch (role) {
    case TRANSACTION_ROLE.AUTH:
      return 'I confirm that I am the authorized signatory for this company. I acknowledge that I may create, edit, approve, and send invoices, view all invoices, and manage users, consistent with the permissions above.';
    case TRANSACTION_ROLE.ADMIN:
      return 'I confirm that I am the Organization Admin. I acknowledge that I may perform all invoicing actions, view all invoices, and manage users, consistent with the permissions above.';
    case TRANSACTION_ROLE.MAKER:
      return 'I confirm that I am the Maker (issuer). I acknowledge that I may create and edit invoices, and view all invoices, consistent with the permissions above.';
    case TRANSACTION_ROLE.CHECKER:
      return 'I confirm that I am the Checker (approver). I acknowledge that I may approve and send invoices, and view all invoices, consistent with the permissions above.';
    default:
      return 'I confirm my role as described above.';
  }
}

function CompanySetup() {
  const navigate = useNavigate();
  const { currentUser, refreshUserData } = useAuth();
  const [formData, setFormData] = useState({
    businessStructure: '',
    legalBusinessName: '',
    companyAddress: '',
    logoUrl: '',
    logoPath: '',
    bnNumber: '',
    verifyDocArticlesUrl: '',
    verifyDocGstHstUrl: '',
    verifyDocBankStatementUrl: '',
    verifyDocObrUrl: '',
    verifyDocCraBnUrl: '',
    gstNumber: '',
    bankTransitNumber: '',
    bankInstitutionNumber: '',
    bankAccountNumber: '',
    invoiceSystem: '',
    userTransactionRole: '',
    eInvoiceIssuerName: '',
    authPrimaryUserAddress: '',
    authSoleSignatoryConfirmed: false,
    mcPrimaryUserFullLegalName: '',
    mcPrimaryUserAddress: '',
    email: '',
    phone: '',
    governmentPhotoIdUrl: '',
    proofOfAddressUrl: '',
    governmentIdUrl: '',
    roleAcknowledgement: false,
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [verifyDocType, setVerifyDocType] = useState('');
  const [mcInvitees, setMcInvitees] = useState([
    { email: '', role: 'maker' },
    { email: '', role: 'checker' },
  ]);
  const [wizardStep, setWizardStep] = useState(0);

  useEffect(() => {
    if (currentUser?.organizationOwnerId) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser?.organizationOwnerId, navigate]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    setFormData((prev) => ({ ...prev, email: currentUser.email || prev.email }));

    (async () => {
      const result = await getOwnCompanyDocument();
      if (result.success && result.data) {
        const d = result.data;
        setFormData((prev) => ({
          ...prev,
          ...d,
          logoPath: d.logoPath || prev.logoPath || '',
          verifyDocArticlesUrl: d.verifyDocArticlesUrl || d.articlesOfIncorporationUrl || '',
          governmentPhotoIdUrl: d.governmentPhotoIdUrl || d.governmentIdUrl || prev.governmentPhotoIdUrl || '',
          proofOfAddressUrl: d.proofOfAddressUrl || prev.proofOfAddressUrl || '',
          email: currentUser.email || d.email || prev.email,
        }));
        setLogoPreview(d.logoUrl || null);
        setIsEditing(true);
        if (Array.isArray(d.mcInvitees) && d.mcInvitees.length > 0) {
          const makerRow = d.mcInvitees.find((r) => r.role === 'maker') || d.mcInvitees[0];
          const checkerRow = d.mcInvitees.find((r) => r.role === 'checker') || d.mcInvitees[1];
          setMcInvitees([
            { email: (makerRow?.email || '').trim(), role: 'maker' },
            { email: (checkerRow?.email || '').trim(), role: 'checker' },
          ]);
        }
      }
    })();
  }, [currentUser?.uid, currentUser?.email]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [wizardStep]);

  const validateWizardStep = (step) => {
    if (step === 0) {
      if (!formData.businessStructure) return 'Select a business structure (point 1).';
      if (!formData.legalBusinessName?.trim()) return 'Enter the legal company name (point 2).';
      if (!formData.companyAddress?.trim()) return 'Enter the registered / business address (point 2).';
      return '';
    }
    if (step === 1) {
      const bn = formData.bnNumber.replace(/\D/g, '');
      if (bn.length > 0 && bn.length !== 9) {
        return 'If you enter a CRA Business Number (BN), it must be exactly 9 digits (point 4).';
      }
      if (!/^\d{5}$/.test(formData.bankTransitNumber.trim())) {
        return 'Transit number must be exactly 5 digits (point 6).';
      }
      if (!/^\d{3}$/.test(formData.bankInstitutionNumber.trim())) {
        return 'Institution number must be exactly 3 digits (point 6).';
      }
      const acct = formData.bankAccountNumber.replace(/\s/g, '');
      if (!/^\d{1,12}$/.test(acct)) return 'Account number must be 1–12 digits only (point 6).';
      return '';
    }
    if (step === 2) {
      if (!formData.invoiceSystem) return 'Select an invoicing model (point 7).';
      if (formData.invoiceSystem === INVOICE_SYSTEM.AUTH) {
        if (!formData.eInvoiceIssuerName?.trim()) {
          return 'Enter your full legal name as on government-issued ID (point 8).';
        }
        if (!formData.authPrimaryUserAddress?.trim()) {
          return 'Enter your address (point 8).';
        }
        if (!formData.authSoleSignatoryConfirmed) {
          return 'Confirm you are the only authorized signatory (point 8).';
        }
      }
      if (formData.invoiceSystem === INVOICE_SYSTEM.MC) {
        if (!formData.mcPrimaryUserFullLegalName?.trim()) {
          return 'Enter your full legal name as on government-issued ID (point 8).';
        }
        if (!formData.mcPrimaryUserAddress?.trim()) return 'Enter your address (point 8).';
        if (
          formData.userTransactionRole !== TRANSACTION_ROLE.MAKER
          && formData.userTransactionRole !== TRANSACTION_ROLE.CHECKER
          && formData.userTransactionRole !== TRANSACTION_ROLE.ADMIN
        ) {
          return 'Select your role: Admin, Maker, or Checker (point 9).';
        }
        const ownerEmail = (currentUser?.email || '').trim().toLowerCase();
        const seen = new Set();
        for (let i = 0; i < mcInvitees.length; i++) {
          const row = mcInvitees[i];
          const em = (row.email || '').trim().toLowerCase();
          const label = `teammate ${i + 1}`;
          if (!em) return `Enter the work email for ${label} (point 10).`;
          if (!EMAIL_RE.test(em)) return `Invalid email for ${label} (point 10).`;
          if (em === ownerEmail) return 'Invited emails cannot include your own sign-in email.';
          if (seen.has(em)) return 'The two invite emails must be different.';
          seen.add(em);
          if (row.role !== 'maker' && row.role !== 'checker') {
            return 'Each invited teammate must be assigned sign-up role Maker or Checker (point 10).';
          }
        }
        const roles = mcInvitees.map((r) => r.role);
        const makers = roles.filter((x) => x === 'maker').length;
        const checkers = roles.filter((x) => x === 'checker').length;
        if (makers !== 1 || checkers !== 1) {
          return 'Assign exactly one invited Maker and one invited Checker between the two teammates (point 10).';
        }
      }
      const digitsPhone = formData.phone.replace(/\D/g, '');
      if (digitsPhone.length < 10) return 'Cell number must be at least 10 digits (point 8).';
      return '';
    }
    if (step === 3) {
      if (!formData.userTransactionRole) return 'Complete the previous step (your role / permissions).';
      if (!formData.roleAcknowledgement) return 'Confirm the acknowledgement (point 14).';
      return '';
    }
    return '';
  };

  const goNext = () => {
    const err = validateWizardStep(wizardStep);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setWizardStep((s) => Math.min(WIZARD_PAGE_COUNT - 1, s + 1));
  };

  const goBack = () => {
    setError('');
    setWizardStep((s) => Math.max(0, s - 1));
  };

  /** Advance without validating (or exit on final step if not saving). */
  const skipThisStep = () => {
    setError('');
    if (wizardStep < WIZARD_PAGE_COUNT - 1) {
      setWizardStep((s) => Math.min(WIZARD_PAGE_COUNT - 1, s + 1));
    } else {
      navigate('/dashboard');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const setInvoiceSystem = (value) => {
    setFormData((p) => {
      if (value === INVOICE_SYSTEM.AUTH) {
        return {
          ...p,
          invoiceSystem: value,
          userTransactionRole: TRANSACTION_ROLE.AUTH,
          authSoleSignatoryConfirmed: false,
          authPrimaryUserAddress: '',
          mcPrimaryUserFullLegalName: '',
          mcPrimaryUserAddress: '',
        };
      }
      const keep =
        p.userTransactionRole === TRANSACTION_ROLE.MAKER ||
        p.userTransactionRole === TRANSACTION_ROLE.CHECKER ||
        p.userTransactionRole === TRANSACTION_ROLE.ADMIN;
      return {
        ...p,
        invoiceSystem: value,
        userTransactionRole: keep ? p.userTransactionRole : '',
        eInvoiceIssuerName: '',
        authSoleSignatoryConfirmed: false,
      };
    });
    if (value === INVOICE_SYSTEM.MC) {
      setMcInvitees([
        { email: '', role: 'maker' },
        { email: '', role: 'checker' },
      ]);
    }
    setError('');
  };

  const setMcInviteRow = (index, patch) => {
    setMcInvitees((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file for the logo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5MB.');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
    setError('');
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData((prev) => ({ ...prev, logoUrl: '', logoPath: '' }));
  };

  const uploadField = useCallback(async (fieldKey, storageSlug, file) => {
    if (!file) return;
    setUploadBusy(fieldKey);
    setError('');
    const res = await uploadBinaryForSetup(file, storageSlug, fieldKey);
    setUploadBusy(null);
    if (res.success) {
      setFormData((prev) => ({ ...prev, [fieldKey]: res.url }));
    } else {
      setError(res.error || 'Upload failed');
    }
  }, []);

  const inputStyle = {
    width: '100%',
    padding: '12px 12px 12px 44px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '15px',
  };
  const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#333' };
  const iconWrap = { position: 'relative' };
  const iconStyle = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' };

  const countVerificationUploads = () =>
    VERIFICATION_DOCS.filter(({ field }) => formData[field]).length;

  const validate = () => {
    for (let s = 0; s < WIZARD_PAGE_COUNT; s++) {
      const err = validateWizardStep(s);
      if (err) return err;
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      let logoUrl = formData.logoUrl;
      if (logoFile) {
        const up = await uploadBinaryForSetup(logoFile, 'logos', 'logo');
        if (!up.success) {
          setError(up.error || 'Logo upload failed');
          setLoading(false);
          return;
        }
        logoUrl = up.url;
      }

      const payload = {
        ...formData,
        logoUrl,
        email: currentUser?.email || formData.email,
        bankAccountNumber: formData.bankAccountNumber.replace(/\s/g, ''),
        bnNumber: formData.bnNumber.replace(/\D/g, ''),
        gstNumber: formData.gstNumber.trim(),
        mcInviteeCount: formData.invoiceSystem === INVOICE_SYSTEM.MC ? 2 : 0,
        mcInvitees: formData.invoiceSystem === INVOICE_SYSTEM.MC ? mcInvitees.map((r) => ({
          email: r.email.trim(),
          role: r.role,
        })) : [],
        authSoleSignatoryConfirmed:
          formData.invoiceSystem === INVOICE_SYSTEM.AUTH ? !!formData.authSoleSignatoryConfirmed : false,
        eInvoiceIssuerName:
          formData.invoiceSystem === INVOICE_SYSTEM.AUTH
            ? formData.eInvoiceIssuerName.trim()
            : '',
        authPrimaryUserAddress:
          formData.invoiceSystem === INVOICE_SYSTEM.AUTH
            ? formData.authPrimaryUserAddress.trim()
            : '',
        companyAddress: formData.companyAddress.trim(),
        mcPrimaryUserFullLegalName:
          formData.invoiceSystem === INVOICE_SYSTEM.MC
            ? formData.mcPrimaryUserFullLegalName.trim()
            : '',
        mcPrimaryUserAddress:
          formData.invoiceSystem === INVOICE_SYSTEM.MC
            ? formData.mcPrimaryUserAddress.trim()
            : '',
        governmentPhotoIdUrl: formData.governmentPhotoIdUrl || '',
        proofOfAddressUrl: formData.proofOfAddressUrl || '',
      };

      const result = await saveCompanyInfo(payload);
      if (result.success) {
        await refreshUserData();
        if (formData.invoiceSystem === INVOICE_SYSTEM.MC && currentUser?.uid) {
          const companyLabel = payload.legalBusinessName || 'your organization';
          const toInvite = mcInvitees.filter((row) => row.email?.trim());
          const inviteResults = await Promise.all(
            toInvite.map(async (row) => {
              const to = row.email.trim();
              const link = `${window.location.origin}/register?email=${encodeURIComponent(to)}&org=${encodeURIComponent(currentUser.uid)}&teamRole=${encodeURIComponent(row.role)}`;
              const roleLabel =
                row.role === 'maker' ? 'Maker (issuer)' : 'Checker (approver)';
              const inviteRes = await sendEmail({
                to,
                subject: `Join ${companyLabel} — e-invoicing platform`,
                text:
                  `You have been invited to join ${companyLabel} on the e-invoicing platform as a ${roleLabel}.\n\n`
                  + 'Create your password and open your account using the link below. Use the same email this message was sent to.\n\n'
                  + `${link}\n\n`
                  + 'If you did not expect this invitation, you can ignore this email.',
              });
              return { to, ...inviteRes };
            })
          );
          const failed = inviteResults.find((r) => !r.success);
          if (failed) {
            setError(
              `Profile saved, but the invite to ${failed.to} could not be sent: ${failed.error || 'email failed'}. You can update the profile to resend.`
            );
            setLogoFile(null);
            setLoading(false);
            return;
          }
        }
        setSuccess('Profile saved successfully!');
        setLogoFile(null);
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to save profile');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--white)', borderRadius: '16px', padding: '48px', border: '1px solid var(--cream-mid)', boxShadow: 'var(--portal-shadow)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-700) 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid var(--gold)' }}>
            <Building size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            {isEditing ? 'Update Your Company Profile' : 'Company Profile Setup'}
          </h1>
          <p style={{ color: '#666', fontSize: '15px' }}>
            Work through the flow in order. Points are numbered 1–14 in sequence: step 2 is 4–6 (BN, HST/GST, and banking), step 3 is 7–10 (invoicing through teammate invites), and the last step is 11–14. Points 11–13 (verification uploads) are optional; point 14 (acknowledgement) is required to complete setup.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee', border: '1px solid #fcc', color: '#c33', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#efe', border: '1px solid #cfc', color: '#3c3', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e8e8e8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontWeight: '700', color: '#333' }}>Setup workflow</span>
              <span style={{ fontSize: '14px', color: 'var(--gold-dark)', fontWeight: '600' }}>Step {wizardStep + 1} of {WIZARD_PAGE_COUNT}</span>
            </div>
            <p style={{ fontSize: '14px', color: '#555', margin: '0 0 12px', lineHeight: 1.5 }}>
              Each step shows a small batch of numbered points. On this page: <strong>{wizardPointRange(wizardStep)}</strong>.
              {wizardStep === 3 && (
                <span> Points <strong>11–13</strong> (uploads) are optional; only point <strong>14</strong> (acknowledgement) is required on this step.</span>
              )}
            </p>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((wizardStep + 1) / WIZARD_PAGE_COUNT) * 100}%`, background: 'linear-gradient(90deg, var(--navy), var(--gold))', borderRadius: '4px', transition: 'width 0.25s ease' }} />
            </div>
          </div>

          {wizardStep === 0 && (
          <>
          <Section num={1} title="Business structure">
            <label style={labelStyle}>Business structure *</label>
            <select name="businessStructure" value={formData.businessStructure} onChange={handleChange} required style={{ ...inputStyle, paddingLeft: '12px' }}>
              <option value="">Select</option>
              {BUSINESS_STRUCTURES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Section>

          <Section num={2} title="Legal company name & address">
            <label style={labelStyle}>Legal company name *</label>
            <div style={iconWrap}>
              <Building size={18} style={iconStyle} />
              <input type="text" name="legalBusinessName" value={formData.legalBusinessName} onChange={handleChange} required placeholder="As registered with CRA" style={inputStyle} />
            </div>
            <div style={{ marginTop: '20px' }}>
              <label style={labelStyle}>Registered / business address *</label>
              <div style={iconWrap}>
                <MapPin size={18} style={{ ...iconStyle, top: '16px', transform: 'none' }} />
                <textarea name="companyAddress" value={formData.companyAddress} onChange={handleChange} required rows={3} placeholder="Street, city, province, postal code" style={{ ...inputStyle, paddingLeft: '44px' }} />
              </div>
            </div>
          </Section>

          <Section num={3} title="Company logo (optional)">
            <p style={{ fontSize: '14px', color: '#555', marginTop: 0, marginBottom: '12px' }}>
              If you add a logo, it is uploaded to <strong>Firebase Storage</strong> when you complete this setup (or update your profile).
            </p>
            {!logoPreview ? (
              <label style={{ display: 'block', padding: '24px', border: '2px dashed #ccc', borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }}>
                <Upload size={24} color="#999" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, color: '#666' }}>Click to upload logo</p>
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
              </label>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={logoPreview} alt="Logo" style={{ maxWidth: '160px', maxHeight: '80px', borderRadius: '8px', border: '2px solid #e0e0e0' }} />
                <button type="button" onClick={removeLogo} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </Section>
          </>
          )}

          {wizardStep === 1 && (
          <>
          <Section num={4} title="Business number (BN)">
            <label style={labelStyle}>CRA Business Number (BN)</label>
            <div style={iconWrap}>
              <Hash size={18} style={iconStyle} />
              <input type="text" name="bnNumber" value={formData.bnNumber} onChange={handleChange} placeholder="Optional — 9-digit CRA BN if you have one" style={inputStyle} />
            </div>
            <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', marginBottom: 0 }}>Leave blank if you do not have a BN yet; you can add it when you update your profile.</p>
          </Section>

          <Section num={5} title="HST/GST registration number (if applicable)">
            <label style={labelStyle}>HST/GST registration number</label>
            <div style={iconWrap}>
              <Hash size={18} style={iconStyle} />
              <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} placeholder="e.g. 123456789 RT0001 — leave blank if not registered" style={inputStyle} />
            </div>
          </Section>

          <Section num={6} title="Payment information (direct deposit)">
            <p style={{ fontSize: '14px', color: '#555', marginTop: 0 }}>Canadian clearing account details for this company.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Transit number * (5 digits)</label>
                <input type="text" name="bankTransitNumber" value={formData.bankTransitNumber} onChange={handleChange} required inputMode="numeric" maxLength={5} placeholder="00000" style={{ ...inputStyle, paddingLeft: '12px' }} />
              </div>
              <div>
                <label style={labelStyle}>Institution number * (3 digits)</label>
                <input type="text" name="bankInstitutionNumber" value={formData.bankInstitutionNumber} onChange={handleChange} required inputMode="numeric" maxLength={3} placeholder="000" style={{ ...inputStyle, paddingLeft: '12px' }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Account number * (up to 12 digits)</label>
              <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} required inputMode="numeric" maxLength={12} placeholder="Account number" style={{ ...inputStyle, paddingLeft: '12px' }} />
            </div>
          </Section>
          </>
          )}

          {wizardStep === 2 && (
          <>
          <Section num={7} title="Invoicing model & permissions">
            <p style={{ fontSize: '14px', color: '#555', marginTop: 0 }}>How will your organization use approvals? The permissions table below updates for your choice — only the roles that apply to this model are shown.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '12px', border: formData.invoiceSystem === INVOICE_SYSTEM.AUTH ? '2px solid var(--gold-dark)' : '1px solid #e0e0e0', borderRadius: '8px' }}>
                <input type="radio" name="invoiceSystem" checked={formData.invoiceSystem === INVOICE_SYSTEM.AUTH} onChange={() => setInvoiceSystem(INVOICE_SYSTEM.AUTH)} />
                <span><strong>Authorized signatory</strong> — One person creates and approves invoices.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '12px', border: formData.invoiceSystem === INVOICE_SYSTEM.MC ? '2px solid var(--gold-dark)' : '1px solid #e0e0e0', borderRadius: '8px' }}>
                <input type="radio" name="invoiceSystem" checked={formData.invoiceSystem === INVOICE_SYSTEM.MC} onChange={() => setInvoiceSystem(INVOICE_SYSTEM.MC)} />
                <span><strong>Maker–Checker</strong> — One person creates invoices; a separate person approves.</span>
              </label>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: '#333' }}>Permissions for your model</h3>
            <PermissionsTableByModel invoiceSystem={formData.invoiceSystem} userTransactionRole={formData.userTransactionRole} />
          </Section>

          <Section
            num={8}
            title={
              formData.invoiceSystem === INVOICE_SYSTEM.AUTH
                ? 'Authorized signatory — identity & contact'
                : formData.invoiceSystem === INVOICE_SYSTEM.MC
                  ? 'Your identity & contact'
                  : 'Your details'
            }
          >
            {formData.invoiceSystem === INVOICE_SYSTEM.AUTH && (
              <>
                <p style={{ fontSize: '14px', color: '#555', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
                  Under the <strong>authorized signatory</strong> model, <strong>only one person</strong> may act on behalf of this company for e-invoicing — the account you are using now. No additional platform users are added.
                </p>
                <label style={labelStyle}>Full legal name as on government-issued ID *</label>
                <input
                  type="text"
                  name="eInvoiceIssuerName"
                  value={formData.eInvoiceIssuerName}
                  onChange={handleChange}
                  required
                  placeholder="Exactly as shown on your government-issued ID"
                  style={{ ...inputStyle, paddingLeft: '12px' }}
                />
                <div style={{ marginTop: '20px' }}>
                  <label style={labelStyle}>Address *</label>
                  <div style={iconWrap}>
                    <MapPin size={18} style={{ ...iconStyle, top: '16px', transform: 'none' }} />
                    <textarea
                      name="authPrimaryUserAddress"
                      value={formData.authPrimaryUserAddress}
                      onChange={handleChange}
                      required
                      rows={3}
                      placeholder="Residential or mailing address (street, city, province, postal code)"
                      style={{ ...inputStyle, paddingLeft: '44px' }}
                    />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginTop: '20px' }}>
                  <input
                    type="checkbox"
                    name="authSoleSignatoryConfirmed"
                    checked={formData.authSoleSignatoryConfirmed}
                    onChange={handleChange}
                    style={{ marginTop: '4px' }}
                  />
                  <span style={{ fontSize: '14px', lineHeight: 1.5 }}>
                    I confirm that I am the <strong>only</strong> authorized signatory and the sole person permitted to issue e-invoices for this company on this platform.
                  </span>
                </label>
              </>
            )}
            {formData.invoiceSystem === INVOICE_SYSTEM.MC && (
              <>
                <p style={{ fontSize: '14px', color: '#555', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
                  Provide details for <strong>you</strong>, the person submitting this company setup.
                </p>
                <label style={labelStyle}>Full legal name as on government-issued ID *</label>
                <input
                  type="text"
                  name="mcPrimaryUserFullLegalName"
                  value={formData.mcPrimaryUserFullLegalName}
                  onChange={handleChange}
                  required
                  placeholder="Exactly as shown on your government-issued ID"
                  style={{ ...inputStyle, paddingLeft: '12px' }}
                />
                <div style={{ marginTop: '20px' }}>
                  <label style={labelStyle}>Address *</label>
                  <div style={iconWrap}>
                    <MapPin size={18} style={{ ...iconStyle, top: '16px', transform: 'none' }} />
                    <textarea
                      name="mcPrimaryUserAddress"
                      value={formData.mcPrimaryUserAddress}
                      onChange={handleChange}
                      required
                      rows={3}
                      placeholder="Residential or mailing address (street, city, province, postal code)"
                      style={{ ...inputStyle, paddingLeft: '44px' }}
                    />
                  </div>
                </div>
              </>
            )}
            {(formData.invoiceSystem === INVOICE_SYSTEM.AUTH || formData.invoiceSystem === INVOICE_SYSTEM.MC) && (
              <>
                <label style={{ ...labelStyle, marginTop: '20px' }}>Email</label>
                <div style={iconWrap}>
                  <Mail size={18} style={iconStyle} />
                  <input type="email" value={formData.email} readOnly style={{ ...inputStyle, background: '#f5f5f5', color: '#555' }} />
                </div>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>Same as your sign-in email.</p>
                <label style={labelStyle}>Cell number *</label>
                <div style={iconWrap}>
                  <Phone size={18} style={iconStyle} />
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="+1 (555) 123-4567" style={inputStyle} />
                </div>
              </>
            )}
            {!formData.invoiceSystem && (
              <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>Select an invoicing model in section 7 first.</p>
            )}
          </Section>

          <Section num={9} title="Your role in this transaction">
            {formData.invoiceSystem === INVOICE_SYSTEM.MC && (
              <>
                <p style={{ fontSize: '14px', color: '#555', marginTop: 0, marginBottom: '12px' }}>
                  Choose whether <strong>you</strong> will be an Admin, Maker, or Checker (see section 7). In section 10 you invite exactly <strong>two</strong> teammates and assign each a sign-up role (one Maker, one Checker).
                </p>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', flexDirection: 'column' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="userTransactionRole"
                      checked={formData.userTransactionRole === TRANSACTION_ROLE.ADMIN}
                      onChange={() => setFormData((p) => ({ ...p, userTransactionRole: TRANSACTION_ROLE.ADMIN }))}
                    />
                    Admin (full permissions and user management)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="userTransactionRole"
                      checked={formData.userTransactionRole === TRANSACTION_ROLE.MAKER}
                      onChange={() => {
                        setFormData((p) => ({ ...p, userTransactionRole: TRANSACTION_ROLE.MAKER }));
                        setMcInvitees((rows) => [
                          { email: rows[0]?.email || '', role: 'maker' },
                          { email: rows[1]?.email || '', role: 'checker' },
                        ]);
                      }}
                    />
                    Maker (issuer)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="userTransactionRole"
                      checked={formData.userTransactionRole === TRANSACTION_ROLE.CHECKER}
                      onChange={() => {
                        setFormData((p) => ({ ...p, userTransactionRole: TRANSACTION_ROLE.CHECKER }));
                        setMcInvitees((rows) => [
                          { email: rows[0]?.email || '', role: 'maker' },
                          { email: rows[1]?.email || '', role: 'checker' },
                        ]);
                      }}
                    />
                    Checker (approver)
                  </label>
                </div>
              </>
            )}
            {formData.invoiceSystem === INVOICE_SYSTEM.AUTH && (
              <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
                <p style={{ fontSize: '14px', color: '#14532d', margin: 0, lineHeight: 1.5 }}>
                  <strong>Single-user model.</strong> Only you may use this company account on the platform. Your role is <strong>authorized signatory</strong> (all permissions in section 7 apply to you). No teammate invitations are used for this model.
                </p>
              </div>
            )}
            {!formData.invoiceSystem && (
              <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>Select an invoicing model in section 7 first.</p>
            )}
          </Section>

          {formData.invoiceSystem === INVOICE_SYSTEM.MC && (
            <Section num={10} title="Invite two teammates — one Maker, one Checker">
              <p style={{ fontSize: '14px', color: '#555', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
                Enter a work email for each person and choose their <strong>sign-up role</strong> (Maker or Checker). You must assign exactly one Maker and one Checker between the two invites. Each person receives a sign-up link for the role you set.
              </p>
              {mcInvitees.map((row, index) => (
                <div
                  key={`mc-invite-${index}`}
                  style={{
                    marginTop: index === 0 ? 0 : '20px',
                    padding: '16px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e8e8e8',
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px' }}>
                    {`Teammate ${index + 1}`}
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Sign-up role *</label>
                    <select
                      value={row.role}
                      onChange={(e) => setMcInviteRow(index, { role: e.target.value })}
                      style={{ ...inputStyle, paddingLeft: '12px' }}
                    >
                      <option value="maker">Maker (issuer)</option>
                      <option value="checker">Checker (approver)</option>
                    </select>
                  </div>
                  <label style={labelStyle}>Work email *</label>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => setMcInviteRow(index, { email: e.target.value })}
                    placeholder="colleague@company.com"
                    style={{ ...inputStyle, paddingLeft: '12px' }}
                  />
                </div>
              ))}
            </Section>
          )}
          </>
          )}

          {wizardStep === 3 && (
          <>
          <Section num={11} title="Business verification — upload one document (optional)">
            <p style={{ fontSize: '14px', color: '#555', marginTop: 0, marginBottom: '16px' }}>
              Optional — choose a document type, then upload <strong>one</strong> file (image or PDF, max 10MB). Files are stored in <strong>Firebase Storage</strong> under your business folder; the download URL is saved on your company profile in Firestore.
            </p>
            <p style={{ fontSize: '13px', color: countVerificationUploads() >= 1 ? 'var(--success)' : '#64748b', marginBottom: '16px', fontWeight: '600' }}>
              Verification document: {countVerificationUploads() >= 1 ? 'provided' : 'not uploaded'}
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Document type</label>
              <select
                value={verifyDocType}
                onChange={(e) => setVerifyDocType(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '12px' }}
              >
                <option value="">Select document to upload…</option>
                {VERIFICATION_DOCS.map(({ field, label }) => (
                  <option key={field} value={field}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Upload file for selected type</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={!verifyDocType || uploadBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && verifyDocType) {
                    uploadField(verifyDocType, 'businessVerification', f);
                    setVerifyDocType('');
                  }
                  e.target.value = '';
                }}
              />
              {verifyDocType && uploadBusy === verifyDocType && (
                <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>Uploading…</span>
              )}
            </div>
            {VERIFICATION_DOCS.some(({ field }) => formData[field]) && (
              <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>Uploaded documents</div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#444' }}>
                  {VERIFICATION_DOCS.filter(({ field }) => formData[field]).map(({ field, label }) => (
                    <li key={field} style={{ marginBottom: '6px' }}>
                      <span style={{ fontWeight: '500' }}>{label}</span>
                      {' — '}
                      <a href={formData[field]} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-dark)' }}>View file</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section num={12} title="Government-issued photo ID (optional)">
            <p style={{ fontSize: '14px', color: '#555', marginTop: 0 }}>
              Optional — upload a clear copy of <strong>photo identification</strong> issued by a government (e.g. driver’s licence, passport) — image or PDF, max 10MB.
            </p>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={uploadBusy === 'governmentPhotoIdUrl'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadField('governmentPhotoIdUrl', 'identityDocuments', f);
                e.target.value = '';
              }}
            />
            {uploadBusy === 'governmentPhotoIdUrl' && <span style={{ fontSize: '13px' }}> Uploading…</span>}
            {formData.governmentPhotoIdUrl && (
              <div style={{ marginTop: '8px' }}>
                <a href={formData.governmentPhotoIdUrl} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: 'var(--gold-dark)' }}>View uploaded photo ID</a>
              </div>
            )}
          </Section>

          <Section num={13} title="Proof of address (optional)">
            <p style={{ fontSize: '14px', color: '#555', marginTop: 0 }}>
              Optional — upload a document showing your <strong>current address</strong> (e.g. utility bill, bank statement, lease — image or PDF, max 10MB).
            </p>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={uploadBusy === 'proofOfAddressUrl'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadField('proofOfAddressUrl', 'identityDocuments', f);
                e.target.value = '';
              }}
            />
            {uploadBusy === 'proofOfAddressUrl' && <span style={{ fontSize: '13px' }}> Uploading…</span>}
            {formData.proofOfAddressUrl && (
              <div style={{ marginTop: '8px' }}>
                <a href={formData.proofOfAddressUrl} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: 'var(--gold-dark)' }}>View uploaded proof of address</a>
              </div>
            )}
          </Section>

          <Section num={14} title="Acknowledgement (required)">
            {formData.userTransactionRole ? (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input type="checkbox" name="roleAcknowledgement" checked={formData.roleAcknowledgement} onChange={handleChange} style={{ marginTop: '4px' }} />
                <span style={{ fontSize: '14px', lineHeight: 1.5 }}>{acknowledgementCopy(formData.userTransactionRole)}</span>
              </label>
            ) : (
              <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
                {!formData.invoiceSystem
                  ? 'Select an invoicing model in section 7 first.'
                  : 'Select your role (Admin, Maker, or Checker) in section 9.'}
              </p>
            )}
          </Section>
          </>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '32px', alignItems: 'center' }}>
            {wizardStep > 0 && (
              <button type="button" onClick={goBack} style={{ padding: '14px 24px', background: 'white', color: '#333', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                Back
              </button>
            )}
            {!isEditing && (
              <button
                type="button"
                onClick={skipThisStep}
                title={
                  wizardStep < WIZARD_PAGE_COUNT - 1
                    ? 'Go to the next step without checking this page. You can use Back to return and complete fields later.'
                    : 'Leave without saving. You can finish your profile later from the dashboard.'
                }
                style={{ padding: '14px 24px', background: 'white', color: '#666', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
              >
                Skip this step
              </button>
            )}
            <div style={{ flex: '1 1 120px' }} />
            {wizardStep < WIZARD_PAGE_COUNT - 1 && (
              <button type="button" onClick={goNext} style={{ padding: '14px 24px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Next
                <span style={{ fontSize: '13px', opacity: 0.95 }}>(next: {wizardPointRange(wizardStep + 1)})</span>
              </button>
            )}
            {wizardStep === WIZARD_PAGE_COUNT - 1 && (
              <button type="submit" disabled={loading} style={{ padding: '14px 24px', background: loading ? '#ccc' : 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? 'Saving…' : <><CheckCircle size={20} />{isEditing ? 'Update profile' : 'Complete setup'}</>}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default CompanySetup;
