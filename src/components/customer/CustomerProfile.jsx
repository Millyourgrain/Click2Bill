import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, MapPin, Mail, Phone, FileText, Upload, CheckCircle, AlertCircle, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { addCustomer, getCustomer, updateCustomer, uploadEngagementAgreement } from '../../services/customerService';

const FREQUENCY_OPTIONS = ['Hourly', 'Daily', 'Weekly', 'Monthly'];

function CustomerProfile() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const isEdit = !!customerId;

  const [formData, setFormData] = useState({
    customerName: '',
    customerDob: '',
    serviceAddress: '',
    customerEmail: '',
    customerPhone: '',
    typeOfService: '',
    frequencyOfService: '',
    hasEngagementAgreement: null,
    engagementAgreementUrl: '',
    isPayorSameAsCustomer: null,
    payorName: '',
    payorDob: '',
    payorRelationship: '',
    payorEmail: '',
    payorPhone: '',
    sendServiceNotification: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isEdit) loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    const result = await getCustomer(customerId);
    if (result.success && result.data) {
      setFormData((prev) => ({ ...prev, ...result.data }));
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
    if (field === 'isPayorSameAsCustomer' && value === true) {
      setFormData((prev) => ({
        ...prev,
        payorName: prev.customerName,
        payorDob: prev.customerDob,
        payorEmail: prev.customerEmail,
        payorPhone: prev.customerPhone,
      }));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !customerId) return;
    setError('');
    const result = await uploadEngagementAgreement(customerId, file);
    if (result.success) {
      setFormData((prev) => ({ ...prev, engagementAgreementUrl: result.url }));
    } else {
      setError(result.error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!formData.customerEmail?.trim()) {
      setError('Customer email is required.');
      return;
    }
    if (formData.isPayorSameAsCustomer === false && !formData.payorEmail?.trim()) {
      setError('Payor email is required when customer/patient and payor are different.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        const result = await updateCustomer(customerId, formData);
        if (result.success) {
          setSuccess('Customer updated successfully.');
          setTimeout(() => navigate('/customers'), 1500);
        } else setError(result.error);
      } else {
        const result = await addCustomer(formData);
        if (result.success) {
          setSuccess('Customer added. You can add an engagement agreement below or go to Dashboard.');
          setFormData((prev) => ({ ...prev, id: result.data.id }));
          if (result.data.id) navigate(`/customers/${result.data.id}`, { replace: true });
        } else setError(result.error);
      }
    } catch (err) {
      setError('Failed to save');
    }
    setLoading(false);
  };

  const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#333' };
  const inputStyle = { width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '15px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button type="button" onClick={() => navigate('/customers')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#667eea' }}>
            <ArrowLeft size={18} /> Back to customers
          </button>
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          {isEdit ? 'Edit customer / patient' : 'New customer profile'}
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
          Customer/patient and payor information for service and invoicing.
        </p>

        {error && (
          <div style={{ background: '#fee', border: '1px solid #fcc', color: '#c33', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#efe', border: '1px solid #cfc', color: '#3c3', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Customer / patient name *</label>
            <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Date of birth</label>
            <input type="date" name="customerDob" value={formData.customerDob} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Service address *</label>
            <textarea name="serviceAddress" value={formData.serviceAddress} onChange={handleChange} required rows={2} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" name="customerEmail" value={formData.customerEmail} onChange={handleChange} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cell / phone</label>
              <input type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleChange} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Type of service</label>
            <input type="text" name="typeOfService" value={formData.typeOfService} onChange={handleChange} placeholder="e.g. Personal care, Nursing" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Frequency of service</label>
            <select name="frequencyOfService" value={formData.frequencyOfService} onChange={handleChange} style={inputStyle}>
              <option value="">Select</option>
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Do you have a customer engagement agreement?</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.hasEngagementAgreement === true} onChange={() => setYesNo('hasEngagementAgreement', true)} />
                Yes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.hasEngagementAgreement === false} onChange={() => setYesNo('hasEngagementAgreement', false)} />
                No
              </label>
            </div>
            {formData.hasEngagementAgreement === true && (
              <div style={{ marginTop: '12px' }}>
                <input type="file" accept="image/*,application/pdf" onChange={isEdit ? handleFileUpload : (e) => setError('Save customer first, then upload.')} style={{ marginTop: '8px' }} />
                {formData.engagementAgreementUrl && <a href={formData.engagementAgreementUrl} target="_blank" rel="noreferrer" style={{ fontSize: '14px', color: '#667eea' }}> View uploaded</a>}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Is customer/patient and payor the same? *</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.isPayorSameAsCustomer === true} onChange={() => setYesNo('isPayorSameAsCustomer', true)} />
                Yes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.isPayorSameAsCustomer === false} onChange={() => setYesNo('isPayorSameAsCustomer', false)} />
                No
              </label>
            </div>
          </div>

          {formData.isPayorSameAsCustomer === false && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Payor name *</label>
                <input type="text" name="payorName" value={formData.payorName} onChange={handleChange} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Payor date of birth</label>
                <input type="date" name="payorDob" value={formData.payorDob} onChange={handleChange} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Relationship to customer/patient</label>
                <input type="text" name="payorRelationship" value={formData.payorRelationship} onChange={handleChange} placeholder="e.g. Spouse, Parent" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Payor email *</label>
                  <input type="email" name="payorEmail" value={formData.payorEmail} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Payor phone</label>
                  <input type="tel" name="payorPhone" value={formData.payorPhone} onChange={handleChange} style={inputStyle} />
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" name="sendServiceNotification" checked={formData.sendServiceNotification} onChange={handleChange} />
              <span style={labelStyle}>Send service notification (email for acknowledgement and onboarding on platform)</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={() => navigate('/customers')} style={{ padding: '12px 24px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
              {loading ? 'Saving...' : isEdit ? 'Update customer' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerProfile;
