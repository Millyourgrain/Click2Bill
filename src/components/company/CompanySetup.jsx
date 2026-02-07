import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, MapPin, Mail, Phone, Hash, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { saveCompanyInfo, getCompanyInfo, uploadCompanyLogo } from '../../services/companyService';
import { useAuth } from '../../contexts/AuthContext';

function CompanySetup() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    companyName: currentUser?.companyName || '',
    companyAddress: '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    gstNumber: '',
    logoUrl: ''
  });
  
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Load existing company info
  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    const result = await getCompanyInfo();
    if (result.success && result.data) {
      setFormData(result.data);
      setLogoPreview(result.data.logoUrl);
      setIsEditing(true);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData({ ...formData, logoUrl: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Upload logo first if there's a new file
      let logoUrl = formData.logoUrl;
      
      if (logoFile) {
        const uploadResult = await uploadCompanyLogo(logoFile);
        if (uploadResult.success) {
          logoUrl = uploadResult.url;
        } else {
          setError(uploadResult.error);
          setLoading(false);
          return;
        }
      }

      // Save company information
      const result = await saveCompanyInfo({
        ...formData,
        logoUrl
      });

      if (result.success) {
        setSuccess('Company information saved successfully!');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to save company information');
    }

    setLoading(false);
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '16px',
        padding: '48px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Building size={32} color="white" />
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '8px'
          }}>
            {isEditing ? 'Update Company Information' : 'Complete Your Profile'}
          </h1>
          <p style={{ color: '#666', fontSize: '15px' }}>
            {isEditing ? 'Edit your company details below' : 'Tell us about your business to get started'}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            color: '#c33',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#efe',
            border: '1px solid #cfc',
            color: '#3c3',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Logo Upload */}
          <div style={{
            marginBottom: '32px',
            padding: '24px',
            background: '#f8f9fa',
            borderRadius: '12px'
          }}>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontWeight: '600',
              fontSize: '15px'
            }}>
              Company Logo (Optional)
            </label>
            
            {!logoPreview ? (
              <label style={{
                display: 'block',
                padding: '40px',
                border: '2px dashed #ccc',
                borderRadius: '8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.borderColor = '#667eea'}
              onMouseLeave={(e) => e.target.style.borderColor = '#ccc'}
              >
                <Upload size={32} color="#999" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#666', marginBottom: '4px' }}>
                  Click to upload logo
                </p>
                <p style={{ fontSize: '13px', color: '#999' }}>
                  PNG, JPG or GIF (max 5MB)
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  style={{ display: 'none' }}
                />
              </label>
            ) : (
              <div style={{
                position: 'relative',
                display: 'inline-block'
              }}>
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  style={{
                    maxWidth: '200px',
                    maxHeight: '120px',
                    borderRadius: '8px',
                    border: '2px solid #e0e0e0'
                  }}
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Form Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '20px'
          }}>
            {/* Company Name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                Company Name *
              </label>
              <div style={{ position: 'relative' }}>
                <Building size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#999'
                }} />
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  placeholder="ABC Corporation"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px'
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                Email *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#999'
                }} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="info@company.com"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px'
                  }}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                Phone
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#999'
                }} />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px'
                  }}
                />
              </div>
            </div>

            {/* Address */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                Company Address
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '16px',
                  color: '#999'
                }} />
                <textarea
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={handleChange}
                  placeholder="123 Main Street&#10;City, Province&#10;Postal Code"
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* GST Number */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                GST Number (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <Hash size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#999'
                }} />
                <input
                  type="text"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  placeholder="GST123456789"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '32px'
          }}>
            {!isEditing && (
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Skip for Now
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: '14px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  {isEditing ? 'Update Information' : 'Complete Setup'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default CompanySetup;