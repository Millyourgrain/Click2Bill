import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Mail, Phone, FileText, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveCustomerProfile, getCustomerProfile, uploadServiceAgreement } from '../../services/customerProfileService';

const INSURANCE_OPTIONS = ['Private', 'Workplace extended health', 'Pending approval', 'None'];
const FREQUENCY_OPTIONS = ['Hourly', 'Daily', 'Weekly', 'Monthly'];
const GOV_PROGRAMS = ['Disability Tax Credit (DTC) eligible', 'Attendant Care benefits (auto insurance injury)', 'Workplace injury coverage', 'Veterans support', 'Senior home-care subsidy', 'Other funding program'];
const ELIGIBLE_CATEGORIES = ['PSW services', 'Nursing services', 'Attendant care', 'Rehabilitation support'];

function CustomerProfileSetup() {
  const navigate = useNavigate();
  const { refreshUserData } = useAuth();
  const [formData, setFormData] = useState({
    customerPatientName: '',
    customerPatientDob: '',
    serviceAddress: '',
    contactEmail: '',
    contactPhone: '',
    isPayorSameAsCustomer: null,
    payorName: '',
    payorDob: '',
    payorEmail: '',
    payorPhone: '',
    sendServiceNotification: false,
    relationshipWithPatient: '',
    typeOfServiceRequired: '',
    serviceFrequency: '',
    serviceAgreementInPlace: null,
    serviceAgreementUrl: '',
    governmentPrograms: [],
    governmentProgramOther: '',
    insuranceCoverage: '',
    insuranceProviderName: '',
    insurancePolicyHolderName: '',
    insurancePolicyNumber: '',
    insuranceEligibleCategories: [],
    recordKeepingMedicalExpense: false,
    recordKeepingInsuranceReimbursement: false,
    privacyConsent: false,
    serviceConsent: false,
    preferredCaregiverGender: '',
    preferredLanguage: '',
    petInHome: '',
    accessibilityNotes: '',
    cancellationPolicyAcknowledgement: false,
    riskAcknowledgement: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [section, setSection] = useState('basic');

  useEffect(() => {
    getCustomerProfile().then((r) => {
      if (r.success && r.data) setFormData((prev) => ({ ...prev, ...r.data }));
    });
  }, []);

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
    if (field === 'isPayorSameAsCustomer' && value === true) {
      setFormData((prev) => ({
        ...prev,
        payorName: prev.customerPatientName,
        payorDob: prev.customerPatientDob,
        payorEmail: prev.contactEmail,
        payorPhone: prev.contactPhone,
      }));
    }
  };

  const toggleGovProgram = (item) => {
    setFormData((prev) => ({
      ...prev,
      governmentPrograms: prev.governmentPrograms.includes(item)
        ? prev.governmentPrograms.filter((x) => x !== item)
        : [...prev.governmentPrograms, item],
    }));
  };

  const toggleEligibleCategory = (item) => {
    setFormData((prev) => ({
      ...prev,
      insuranceEligibleCategories: prev.insuranceEligibleCategories.includes(item)
        ? prev.insuranceEligibleCategories.filter((x) => x !== item)
        : [...prev.insuranceEligibleCategories, item],
    }));
  };

  const handleAgreementUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const result = await uploadServiceAgreement(file);
    if (result.success) setFormData((prev) => ({ ...prev, serviceAgreementUrl: result.url }));
    else setError(result.error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (formData.isPayorSameAsCustomer === false && !formData.payorEmail?.trim()) {
      setError('Payor email is required when customer/patient and payor are different.');
      return;
    }
    setLoading(true);
    const result = await saveCustomerProfile(formData);
    setLoading(false);
    if (result.success) {
      setSuccess('Profile saved.');
      await refreshUserData();
      setTimeout(() => navigate('/customer-dashboard'), 1500);
    } else setError(result.error);
  };

  const block = (id, title, children) => (
    <div key={id} style={{ marginBottom: '16px', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
      <button type="button" onClick={() => setSection(section === id ? null : id)} style={{ width: '100%', padding: '16px 20px', background: '#f0fdfa', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>
        {title}
        {section === id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {section === id && <div style={{ padding: '24px', background: 'white' }}>{children}</div>}
    </div>
  );

  const label = { display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#333' };
  const input = { width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '15px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdfa', padding: '24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Customer / Payor profile</h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Complete your details for the e-invoicing platform.</p>

        {error && (
          <div style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {block('basic', 'Customer/patient & contact', (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Customer/patient name *</label>
                <input type="text" name="customerPatientName" value={formData.customerPatientName} onChange={handleChange} required style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Customer/patient DOB</label>
                <input type="date" name="customerPatientDob" value={formData.customerPatientDob} onChange={handleChange} style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Service address *</label>
                <textarea name="serviceAddress" value={formData.serviceAddress} onChange={handleChange} required rows={2} style={input} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={label}>Email *</label>
                  <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} required style={input} />
                </div>
                <div>
                  <label style={label}>Cell / phone</label>
                  <input type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange} style={input} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Is customer/patient and payor the same? *</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label><input type="radio" checked={formData.isPayorSameAsCustomer === true} onChange={() => setYesNo('isPayorSameAsCustomer', true)} /> Yes</label>
                  <label><input type="radio" checked={formData.isPayorSameAsCustomer === false} onChange={() => setYesNo('isPayorSameAsCustomer', false)} /> No</label>
                </div>
              </div>
              {formData.isPayorSameAsCustomer === false && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={label}>Payor name *</label>
                    <input type="text" name="payorName" value={formData.payorName} onChange={handleChange} style={input} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={label}>Payor DOB</label>
                    <input type="date" name="payorDob" value={formData.payorDob} onChange={handleChange} style={input} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={label}>Payor email *</label>
                      <input type="email" name="payorEmail" value={formData.payorEmail} onChange={handleChange} required style={input} />
                    </div>
                    <div>
                      <label style={label}>Payor phone</label>
                      <input type="tel" name="payorPhone" value={formData.payorPhone} onChange={handleChange} style={input} />
                    </div>
                  </div>
                </>
              )}
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" name="sendServiceNotification" checked={formData.sendServiceNotification} onChange={handleChange} />
                  <span style={label}>Send service notification (acknowledgement and onboarding)</span>
                </label>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={label}>Relationship with customer/patient</label>
                <input type="text" name="relationshipWithPatient" value={formData.relationshipWithPatient} onChange={handleChange} placeholder="e.g. Self, Spouse, Parent" style={input} />
              </div>
            </>
          ))}

          {block('service', 'Type of service & agreement', (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Type of service required</label>
                <input type="text" name="typeOfServiceRequired" value={formData.typeOfServiceRequired} onChange={handleChange} placeholder="e.g. Personal care, Nursing" style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Service frequency</label>
                <select name="serviceFrequency" value={formData.serviceFrequency} onChange={handleChange} style={input}>
                  <option value="">Select</option>
                  {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Service agreement in place?</label>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  <label><input type="radio" checked={formData.serviceAgreementInPlace === true} onChange={() => setFormData((p) => ({ ...p, serviceAgreementInPlace: true }))} /> Yes</label>
                  <label><input type="radio" checked={formData.serviceAgreementInPlace === false} onChange={() => setFormData((p) => ({ ...p, serviceAgreementInPlace: false }))} /> No</label>
                </div>
                {formData.serviceAgreementInPlace === true && (
                  <div>
                    <input type="file" accept="image/*,application/pdf" onChange={handleAgreementUpload} />
                    {formData.serviceAgreementUrl && <a href={formData.serviceAgreementUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', fontSize: '14px', color: '#0d9488' }}>View uploaded</a>}
                  </div>
                )}
              </div>
            </>
          ))}

          {block('government', 'Government program (Ontario)', (
            <>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>Select any that apply:</p>
              {GOV_PROGRAMS.map((g) => (
                <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.governmentPrograms.includes(g)} onChange={() => toggleGovProgram(g)} />
                  <span>{g}</span>
                </label>
              ))}
              {formData.governmentPrograms.includes('Other funding program') && (
                <div style={{ marginTop: '12px' }}>
                  <label style={label}>Other (specify)</label>
                  <input type="text" name="governmentProgramOther" value={formData.governmentProgramOther} onChange={handleChange} style={input} />
                </div>
              )}
            </>
          ))}

          {block('insurance', 'Insurance & policy details', (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Insurance coverage</label>
                <select name="insuranceCoverage" value={formData.insuranceCoverage} onChange={handleChange} style={input}>
                  <option value="">Select</option>
                  {INSURANCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Insurance provider name</label>
                <input type="text" name="insuranceProviderName" value={formData.insuranceProviderName} onChange={handleChange} style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Policy holder name</label>
                <input type="text" name="insurancePolicyHolderName" value={formData.insurancePolicyHolderName} onChange={handleChange} style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Policy number / Claim ID</label>
                <input type="text" name="insurancePolicyNumber" value={formData.insurancePolicyNumber} onChange={handleChange} style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Eligible service categories</label>
                {ELIGIBLE_CATEGORIES.map((c) => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.insuranceEligibleCategories.includes(c)} onChange={() => toggleEligibleCategory(c)} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
              <div>
                <label style={{ ...label, marginBottom: '8px' }}>Record keeping for</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" name="recordKeepingMedicalExpense" checked={formData.recordKeepingMedicalExpense} onChange={handleChange} />
                  <span>Medical expense tax credit claims</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '6px' }}>
                  <input type="checkbox" name="recordKeepingInsuranceReimbursement" checked={formData.recordKeepingInsuranceReimbursement} onChange={handleChange} />
                  <span>Insurance reimbursement</span>
                </label>
              </div>
            </>
          ))}

          {block('consent', 'Consents & preferences', (
            <>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" name="privacyConsent" checked={formData.privacyConsent} onChange={handleChange} style={{ marginTop: '4px' }} />
                  <span><strong>Privacy consent:</strong> Customer/Payor agrees to storage of personal and limited health data, sharing info with assigned PSW/nurse, and invoice sharing with insurers.</span>
                </label>
              </div>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" name="serviceConsent" checked={formData.serviceConsent} onChange={handleChange} style={{ marginTop: '4px' }} />
                  <span><strong>Service consent:</strong> Payor acknowledges platform connects independent providers; providers are not employees (if applicable). Substitute Decision Maker Consent (if applicable).</span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={label}>Preferred caregiver gender</label>
                  <input type="text" name="preferredCaregiverGender" value={formData.preferredCaregiverGender} onChange={handleChange} placeholder="Any / Male / Female" style={input} />
                </div>
                <div>
                  <label style={label}>Preferred language</label>
                  <input type="text" name="preferredLanguage" value={formData.preferredLanguage} onChange={handleChange} placeholder="e.g. English" style={input} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Pet in home (safety disclosure)</label>
                <input type="text" name="petInHome" value={formData.petInHome} onChange={handleChange} placeholder="e.g. Dog, Cat, None" style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Accessibility notes (stairs, lift, wheelchair)</label>
                <textarea name="accessibilityNotes" value={formData.accessibilityNotes} onChange={handleChange} rows={2} placeholder="Any access or mobility details" style={input} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" name="cancellationPolicyAcknowledgement" checked={formData.cancellationPolicyAcknowledgement} onChange={handleChange} />
                  <span>Cancellation policy acknowledgement</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" name="riskAcknowledgement" checked={formData.riskAcknowledgement} onChange={handleChange} />
                  <span>Risk acknowledgment (mobility/fall risk)</span>
                </label>
              </div>
            </>
          ))}

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button type="button" onClick={() => navigate('/customer-dashboard')} style={{ padding: '12px 24px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Skip for now</button>
            <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
              {loading ? 'Saving...' : 'Save and go to dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerProfileSetup;
