import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { registerCustomer } from '../../services/authService';
import { UserPlus, Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react';

function RegisterCustomer() {
  const navigate = useNavigate();
  const { refreshUserData } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteEmail = searchParams.get('email') || '';

  const [formData, setFormData] = useState({
    fullName: '',
    email: inviteEmail,
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const result = await registerCustomer(formData);
    if (result.success) {
      await refreshUserData();
      navigate('/customer-profile-setup');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const base = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', padding: '40px 20px' };
  const card = { background: 'white', padding: '48px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: '520px' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#333' };
  const inputStyle = { width: '100%', padding: '12px 12px 12px 44px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '15px' };
  const iconWrap = { position: 'relative' };

  return (
    <div style={base}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={40} color="white" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', color: '#1a1a1a' }}>Customer / Payor sign up</h1>
          <p style={{ color: '#666', fontSize: '15px' }}>Create your account on the e-invoicing platform</p>
        </div>

        {error && (
          <div style={{ background: '#fee', border: '1px solid #fcc', color: '#c33', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Full Name *</label>
            <div style={iconWrap}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Your full name" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Email *</label>
            <div style={iconWrap}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="you@example.com" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Phone (optional)</label>
            <div style={iconWrap}>
              <Phone size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+1 (555) 123-4567" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Password *</label>
            <div style={iconWrap}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="••••••••" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Confirm password *</label>
            <div style={iconWrap}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required placeholder="••••••••" style={inputStyle} />
            </div>
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: loading ? '#ccc' : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? 'Creating account...' : <><CheckCircle size={20} /> Create account</>}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#666' }}>
            Already have an account? <Link to="/login" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: '600' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterCustomer;
