import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  MapPin,
  Mail,
  Phone,
  Hash,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  User,
  FileText,
  Shield,
  Car,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  saveCompanyInfo,
  getCompanyInfo,
  uploadCompanyLogo,
  uploadArticlesOfIncorporation,
  uploadBankingDetails,
  uploadCommercialLiabilityPolicy,
  uploadGeneralLiabilityPolicy,
  deleteCompanyLogo,
} from '../../services/companyService';
import { useAuth } from '../../contexts/AuthContext';

const BUSINESS_STRUCTURES = [
  'Sole proprietorship',
  'Corporation',
  'Partnership',
  'Non-Profit',
];

const ROLE_TYPES = [
  'PSW',
  'RPN',
  'RN',
  'Caregiver/companion',
  'Independent contractor/Service provider',
  'Other',
];

const WSIB_OPTIONS = ['registered', 'exempt'];

/** Stable component: section content is always in DOM (display toggled) so input focus is preserved */
function CollapsibleSection({ id, title, icon: Icon, isExpanded, onToggle, children }) {
  return (
    <div style={{ marginBottom: '16px', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        style={{
          width: '100%',
          padding: '16px 20px',
          background: '#f8f9fa',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '600',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={20} color="#667eea" />
          {title}
        </span>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      <div style={{ display: isExpanded ? 'block' : 'none', padding: '24px', background: 'white' }}>
        {children}
      </div>
    </div>
  );
}

function CompanySetup() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    companyName: '',
    legalBusinessName: '',
    operationalNameDba: '',
    companyAddress: '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    logoUrl: '',
    workingIndependently: null,
    businessStructure: '',
    articlesOfIncorporationUrl: '',
    name: '',
    dateOfBirth: '',
    provincialFederalId: '',
    roleTypeOfService: '',
    roleTypeOther: '',
    gstNumber: '',
    bankingDetailsUrl: '',
    commercialLiabilityInsurance: null,
    commercialLiabilityPolicyUrl: '',
    commercialLiabilityInterested: null,
    generalLiabilityInsurance: null,
    generalLiabilityPolicyUrl: '',
    generalLiabilityInterested: null,
    insuranceAcknowledgement: false,
    wsibCoverage: '',
    quoteTravelCostOnInvoice: null,
    vehicleDetails: null,
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedSection, setExpandedSection] = useState('business');
  const [vehicleData, setVehicleData] = useState({
    vehicleType: 'car',
    insuranceCost: '',
    kmRuns: '',
    usagePattern: { highway: 50, city: 40, heavy: 10 },
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const result = await getCompanyInfo();
    if (result.success && result.data) {
      setFormData((prev) => ({ ...prev, ...result.data }));
      setLogoPreview(result.data.logoUrl);
      if (result.data.vehicleDetails) setVehicleData(result.data.vehicleDetails);
      setIsEditing(true);
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

  const setYesNo = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
  };

  const handleFileUpload = async (uploadFn, file, field) => {
    if (!file) return;
    setError('');
    const result = await uploadFn(file);
    if (result.success) {
      setFormData((prev) => ({ ...prev, [field]: result.url }));
    } else {
      setError(result.error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let logoUrl = formData.logoUrl;
      if (logoFile) {
        const uploadResult = await uploadCompanyLogo(logoFile);
        if (uploadResult.success) logoUrl = uploadResult.url;
        else {
          setError(uploadResult.error);
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...formData,
        logoUrl,
        vehicleDetails:
          formData.quoteTravelCostOnInvoice === true ? vehicleData : null,
      };

      const result = await saveCompanyInfo(payload);
      if (result.success) {
        setSuccess('Profile saved successfully!');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to save profile');
    }
    setLoading(false);
  };

  const toggleSection = (section) => {
    setExpandedSection((s) => (s === section ? null : section));
  };

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

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: '48px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Building size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            {isEditing ? 'Update Your Profile' : 'Set Up Your Profile'}
          </h1>
          <p style={{ color: '#666', fontSize: '15px' }}>
            Complete these details for the e-invoicing platform (independent PSW / Service worker)
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
          <CollapsibleSection id="business" title="Business structure & legal" icon={Building} isExpanded={expandedSection === 'business'} onToggle={toggleSection}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Company name *</label>
              <div style={iconWrap}>
                <Building size={18} style={iconStyle} />
                <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} required placeholder="e.g. ABC Care Services" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Are you working independently? *</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="workingIndependently" checked={formData.workingIndependently === true} onChange={() => setYesNo('workingIndependently', true)} />
                  Yes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="workingIndependently" checked={formData.workingIndependently === false} onChange={() => setYesNo('workingIndependently', false)} />
                  No
                </label>
              </div>
            </div>
            {formData.workingIndependently === true && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Business structure *</label>
                  <select name="businessStructure" value={formData.businessStructure} onChange={handleChange} required style={{ ...inputStyle, paddingLeft: '12px' }}>
                    <option value="">Select</option>
                    {BUSINESS_STRUCTURES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Legal business name *</label>
                  <input type="text" name="legalBusinessName" value={formData.legalBusinessName} onChange={handleChange} required placeholder="Legal name" style={inputStyle} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Articles of incorporation (optional)</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => e.target.files[0] && handleFileUpload(uploadArticlesOfIncorporation, e.target.files[0], 'articlesOfIncorporationUrl')} style={{ marginTop: '8px' }} />
                  {formData.articlesOfIncorporationUrl && <a href={formData.articlesOfIncorporationUrl} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: '#667eea' }}>View uploaded</a>}
                </div>
              </>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="personal" title="Name, role & contact" icon={User} isExpanded={expandedSection === 'personal'} onToggle={toggleSection}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Name *</label>
              <div style={iconWrap}>
                <User size={18} style={iconStyle} />
                <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Full name" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Date of birth</label>
              <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} style={{ ...inputStyle, paddingLeft: '12px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Provincial / Federal ID (optional)</label>
              <input type="text" name="provincialFederalId" value={formData.provincialFederalId} onChange={handleChange} placeholder="Optional" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Role / type of service *</label>
              <select name="roleTypeOfService" value={formData.roleTypeOfService} onChange={handleChange} required style={{ ...inputStyle, paddingLeft: '12px' }}>
                <option value="">Select</option>
                {ROLE_TYPES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {formData.roleTypeOfService === 'Other' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Other (specify)</label>
                <input type="text" name="roleTypeOther" value={formData.roleTypeOther} onChange={handleChange} style={inputStyle} />
              </div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Operational name (DBA) – optional</label>
              <input type="text" name="operationalNameDba" value={formData.operationalNameDba} onChange={handleChange} placeholder="Doing business as" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Logo (optional)</label>
              {!logoPreview ? (
                <label style={{ display: 'block', padding: '24px', border: '2px dashed #ccc', borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }}>
                  <Upload size={24} color="#999" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, color: '#666' }}>Click to upload logo</p>
                  <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                </label>
              ) : (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={logoPreview} alt="Logo" style={{ maxWidth: '160px', maxHeight: '80px', borderRadius: '8px', border: '2px solid #e0e0e0' }} />
                  <button type="button" onClick={removeLogo} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Business address *</label>
              <div style={iconWrap}>
                <MapPin size={18} style={{ ...iconStyle, top: '16px', transform: 'none' }} />
                <textarea name="companyAddress" value={formData.companyAddress} onChange={handleChange} required rows={3} placeholder="Street, City, Province, Postal code" style={{ ...inputStyle, paddingLeft: '44px' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Email *</label>
                <div style={iconWrap}>
                  <Mail size={18} style={iconStyle} />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Cell number</label>
                <div style={iconWrap}>
                  <Phone size={18} style={iconStyle} />
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} style={inputStyle} />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="tax" title="HST/GST & payment" icon={Hash} isExpanded={expandedSection === 'tax'} onToggle={toggleSection}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>HST/GST registration number (if applicable)</label>
              <div style={iconWrap}>
                <Hash size={18} style={iconStyle} />
                <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} placeholder="e.g. 123456789 RT0001" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Payment information – void cheque / direct deposit form</label>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => e.target.files[0] && handleFileUpload(uploadBankingDetails, e.target.files[0], 'bankingDetailsUrl')} style={{ marginTop: '8px' }} />
              {formData.bankingDetailsUrl && <a href={formData.bankingDetailsUrl} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: '#667eea', display: 'block', marginTop: '8px' }}>View uploaded</a>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="insurance" title="Insurance" icon={Shield} isExpanded={expandedSection === 'insurance'} onToggle={toggleSection}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Commercial liability insurance</label>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={formData.commercialLiabilityInsurance === true} onChange={() => setYesNo('commercialLiabilityInsurance', true)} />
                  Yes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={formData.commercialLiabilityInsurance === false} onChange={() => setYesNo('commercialLiabilityInsurance', false)} />
                  No
                </label>
              </div>
              {formData.commercialLiabilityInsurance === true && (
                <div style={{ marginTop: '8px' }}>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => e.target.files[0] && handleFileUpload(uploadCommercialLiabilityPolicy, e.target.files[0], 'commercialLiabilityPolicyUrl')} />
                  {formData.commercialLiabilityPolicyUrl && <a href={formData.commercialLiabilityPolicyUrl} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: '#667eea' }}> View uploaded</a>}
                </div>
              )}
              {formData.commercialLiabilityInsurance === false && (
                <div style={{ marginTop: '8px' }}>
                  <label style={{ ...labelStyle, fontWeight: '500' }}>Interested in obtaining one?</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" checked={formData.commercialLiabilityInterested === true} onChange={() => setFormData((p) => ({ ...p, commercialLiabilityInterested: true }))} />
                      Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" checked={formData.commercialLiabilityInterested === false} onChange={() => setFormData((p) => ({ ...p, commercialLiabilityInterested: false }))} />
                      No
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>General liability insurance</label>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={formData.generalLiabilityInsurance === true} onChange={() => setYesNo('generalLiabilityInsurance', true)} />
                  Yes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={formData.generalLiabilityInsurance === false} onChange={() => setYesNo('generalLiabilityInsurance', false)} />
                  No
                </label>
              </div>
              {formData.generalLiabilityInsurance === true && (
                <div style={{ marginTop: '8px' }}>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => e.target.files[0] && handleFileUpload(uploadGeneralLiabilityPolicy, e.target.files[0], 'generalLiabilityPolicyUrl')} />
                  {formData.generalLiabilityPolicyUrl && <a href={formData.generalLiabilityPolicyUrl} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: '#667eea' }}> View uploaded</a>}
                </div>
              )}
              {formData.generalLiabilityInsurance === false && (
                <div style={{ marginTop: '8px' }}>
                  <label style={{ ...labelStyle, fontWeight: '500' }}>Interested in obtaining one?</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" checked={formData.generalLiabilityInterested === true} onChange={() => setFormData((p) => ({ ...p, generalLiabilityInterested: true }))} />
                      Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" checked={formData.generalLiabilityInterested === false} onChange={() => setFormData((p) => ({ ...p, generalLiabilityInterested: false }))} />
                      No
                    </label>
                  </div>
                </div>
              )}
            </div>
            {(formData.commercialLiabilityInsurance === false || formData.generalLiabilityInsurance === false) && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" name="insuranceAcknowledgement" checked={formData.insuranceAcknowledgement} onChange={handleChange} style={{ marginTop: '4px' }} />
                  <span style={{ fontSize: '14px' }}>Provider acknowledges responsibility for obtaining insurance where required.</span>
                </label>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="wsib" title="WSIB coverage" icon={FileText} isExpanded={expandedSection === 'wsib'} onToggle={toggleSection}>
            <label style={labelStyle}>WSIB coverage *</label>
            <select name="wsibCoverage" value={formData.wsibCoverage} onChange={handleChange} required style={{ ...inputStyle, paddingLeft: '12px' }}>
              <option value="">Select</option>
              {WSIB_OPTIONS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </CollapsibleSection>

          <CollapsibleSection id="travel" title="Travel on invoice" icon={Car} isExpanded={expandedSection === 'travel'} onToggle={toggleSection}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Quote travel cost on the invoice? *</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={formData.quoteTravelCostOnInvoice === true} onChange={() => setYesNo('quoteTravelCostOnInvoice', true)} />
                  Yes – save vehicle details below (once)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={formData.quoteTravelCostOnInvoice === false} onChange={() => setYesNo('quoteTravelCostOnInvoice', false)} />
                  No – record travel distance for taxation only
                </label>
              </div>
            </div>
            {formData.quoteTravelCostOnInvoice === true && (
              <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Vehicle type</label>
                  <select value={vehicleData.vehicleType} onChange={(e) => setVehicleData((v) => ({ ...v, vehicleType: e.target.value }))} style={{ ...inputStyle, paddingLeft: '12px' }}>
                    <option value="car">Car / Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="pickup">Pickup</option>
                    <option value="van">Van</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Insurance cost (annual $, optional)</label>
                  <input type="number" min="0" step="0.01" value={vehicleData.insuranceCost} onChange={(e) => setVehicleData((v) => ({ ...v, insuranceCost: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Km runs (optional)</label>
                  <input type="number" min="0" value={vehicleData.kmRuns} onChange={(e) => setVehicleData((v) => ({ ...v, kmRuns: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Usage pattern % (highway / city / heavy)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <input type="number" min="0" max="100" value={vehicleData.usagePattern?.highway ?? 50} onChange={(e) => setVehicleData((v) => ({ ...v, usagePattern: { ...v.usagePattern, highway: Number(e.target.value) } }))} placeholder="Highway" style={inputStyle} />
                    <input type="number" min="0" max="100" value={vehicleData.usagePattern?.city ?? 40} onChange={(e) => setVehicleData((v) => ({ ...v, usagePattern: { ...v.usagePattern, city: Number(e.target.value) } }))} placeholder="City" style={inputStyle} />
                    <input type="number" min="0" max="100" value={vehicleData.usagePattern?.heavy ?? 10} onChange={(e) => setVehicleData((v) => ({ ...v, usagePattern: { ...v.usagePattern, heavy: Number(e.target.value) } }))} placeholder="Heavy" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}
          </CollapsibleSection>

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            {!isEditing && (
              <button type="button" onClick={() => navigate('/dashboard')} style={{ flex: 1, padding: '14px', background: 'white', color: '#666', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                Skip for now
              </button>
            )}
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '14px', background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? 'Saving...' : <><CheckCircle size={20} />{isEditing ? 'Update profile' : 'Complete setup'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CompanySetup;
