import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { registerUser } from '../../services/authService';
import { UserPlus, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';

function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get('org')?.trim() || '';
  const teamRoleParam = searchParams.get('teamRole')?.trim() || '';
  const inviteEmail = searchParams.get('email')?.trim() || '';
  const isTeamInvite =
    Boolean(orgId) &&
    (teamRoleParam === 'maker' || teamRoleParam === 'checker' || teamRoleParam === 'admin');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (inviteEmail) {
      setFormData((f) => ({ ...f, email: inviteEmail }));
    }
  }, [inviteEmail]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isTeamInvite && formData.email.trim().toLowerCase() !== inviteEmail.toLowerCase()) {
      setError('Use the same email address this invitation was sent to.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await registerUser({
      ...formData,
      organizationOwnerId: isTeamInvite ? orgId : undefined,
      teamRole: isTeamInvite ? teamRoleParam : undefined,
    });

    if (result.success) {
      navigate(isTeamInvite ? '/dashboard' : '/setup-company');
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  const inputShell = {
    width: '100%',
    padding: '12px 12px 12px 40px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '15px',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#333',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{
        background: 'white',
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '450px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UserPlus size={40} color="white" />
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '8px',
            color: '#1a1a1a'
          }}>
            {isTeamInvite ? 'Accept your team invite' : 'Create your account'}
          </h1>
          <p style={{ color: '#666', fontSize: '15px' }}>
            {isTeamInvite
              ? `You’re joining as ${teamRoleParam === 'maker' ? 'a Maker (issuer)' : teamRoleParam === 'checker' ? 'a Checker (approver)' : 'an Organization Admin'}. Set a password for your invited email, then you’ll go to the dashboard.`
              : 'Use your work email and a secure password. You’ll add company details next.'}
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            color: '#c33',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Email address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                readOnly={Boolean(isTeamInvite && inviteEmail)}
                placeholder="you@company.com"
                style={{
                  ...inputShell,
                  ...(isTeamInvite && inviteEmail ? { background: '#f5f5f5', color: '#555' } : {}),
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                placeholder="At least 6 characters"
                style={inputShell}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Confirm password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#999' }} />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
                style={inputShell}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
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
              <span>Creating account…</span>
            ) : (
              <>
                <CheckCircle size={20} />
                <span>Create account</span>
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '14px', color: '#666' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '600'
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
