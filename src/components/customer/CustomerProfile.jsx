import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { addCustomer, getCustomer, updateCustomer } from '../../services/customerService';

function CustomerProfile() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const isEdit = !!customerId;

  const [formData, setFormData] = useState({
    entityType: 'individual',
    businessName: '',
    customerName: '',
    serviceAddress: '',
    customerEmail: '',
    customerPhone: '',
    isPayorSameAsCustomer: null,
    payorName: '',
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
      const d = result.data;
      const entityType = d.entityType || (d.businessName ? 'business' : 'individual');
      setFormData((prev) => ({
        ...prev,
        ...d,
        entityType,
        businessName: d.businessName ?? '',
        customerName: d.customerName ?? '',
      }));
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

  const setPayorSame = (value) => {
    setFormData((prev) => {
      if (value !== true) return { ...prev, isPayorSameAsCustomer: value };
      const primaryName =
        prev.entityType === 'business' ? (prev.businessName || prev.customerName) : prev.customerName;
      return {
        ...prev,
        isPayorSameAsCustomer: value,
        payorName: primaryName,
        payorEmail: prev.customerEmail,
        payorPhone: prev.customerPhone,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const entityType = formData.entityType || 'individual';
    const bName = (formData.businessName || '').trim();
    const cName = (formData.customerName || '').trim();
    if (entityType === 'business' && !bName) {
      setError('Business name is required.');
      return;
    }
    if (entityType === 'individual' && !cName) {
      setError('Customer name is required.');
      return;
    }
    if (!formData.customerEmail?.trim()) {
      setError('Customer email is required.');
      return;
    }
    if (formData.isPayorSameAsCustomer === false && !formData.payorEmail?.trim()) {
      setError('Payor email is required when customer and payor are different.');
      return;
    }
    const payload = {
      ...formData,
      entityType,
      businessName: entityType === 'business' ? bName : '',
      customerName: entityType === 'business' ? bName : cName,
      customerDob: '',
      typeOfService: '',
      frequencyOfService: '',
      hasEngagementAgreement: null,
      engagementAgreementUrl: '',
      payorDob: '',
    };

    setLoading(true);
    try {
      if (isEdit) {
        const { id: _docId, ...updatePayload } = payload;
        const result = await updateCustomer(customerId, updatePayload);
        if (result.success) {
          setSuccess('Customer updated successfully.');
          setTimeout(() => navigate('/customers'), 1500);
        } else setError(result.error);
      } else {
        const result = await addCustomer(payload);
        if (result.success) {
          setSuccess('Customer added.');
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
          {isEdit ? 'Edit customer' : 'New customer profile'}
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
          Customer and payor information for service and invoicing.
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
            <label style={labelStyle} htmlFor="entityType">Entity *</label>
            <select
              id="entityType"
              name="entityType"
              value={formData.entityType}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="business">Business name</option>
              <option value="individual">Customer name</option>
            </select>
          </div>
          {formData.entityType === 'business' ? (
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Business name *</label>
              <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} style={inputStyle} />
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Customer name *</label>
              <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Service address *</label>
            <textarea name="serviceAddress" value={formData.serviceAddress} onChange={handleChange} required rows={3} style={inputStyle} placeholder="Street, city, province, postal code" />
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
            <label style={labelStyle}>Is customer and payor the same? *</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.isPayorSameAsCustomer === true} onChange={() => setPayorSame(true)} />
                Yes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={formData.isPayorSameAsCustomer === false} onChange={() => setPayorSame(false)} />
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
                <label style={labelStyle}>Relationship to customer</label>
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
