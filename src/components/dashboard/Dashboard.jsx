import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Building, FileText, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/authService';
import { getCompanyInfo } from '../../services/companyService';
import { getInvoiceStats } from '../../services/invoiceService';

function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [companyInfo, setCompanyInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const companyResult = await getCompanyInfo();
      if (companyResult.success) {
        setCompanyInfo(companyResult.data);
      }

      const statsResult = await getInvoiceStats();
      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          border: '4px solid #e0e0e0',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '20px 40px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0' }}>
              Dashboard
            </h1>
            <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>
              Welcome back, {currentUser?.fullName || currentUser?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 40px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginBottom: '40px'
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#e3f2fd',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText size={24} color="#2196f3" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>
                  Total Invoices
                </p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
                  {stats?.totalInvoices || 0}
                </p>
              </div>
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#e8f5e9',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={24} color="#4caf50" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>
                  Total Revenue
                </p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
                  ${(stats?.totalRevenue || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 24px 0' }}>
            Quick Actions
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <button
              onClick={() => navigate('/invoice')}
              style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <FileText size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Create Invoice</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Generate new invoice</p>
            </button>

            <button
              onClick={() => navigate('/travel')}
              style={{
                padding: '20px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <TrendingUp size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Travel Calculator</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Calculate travel costs</p>
            </button>

            <button
              onClick={() => navigate('/setup-company')}
              style={{
                padding: '20px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Building size={24} style={{ marginBottom: '8px' }} />
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Company Profile</p>
              <p style={{ fontSize: '13px', opacity: 0.9, margin: 0 }}>Update your information</p>
            </button>
          </div>
        </div>

        {companyInfo && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginTop: '24px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 24px 0' }}>
              Company Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Company Name</p>
                <p style={{ fontWeight: '600', margin: 0 }}>{companyInfo.companyName}</p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>Email</p>
                <p style={{ fontWeight: '600', margin: 0 }}>{companyInfo.email}</p>
              </div>
              {companyInfo.gstNumber && (
                <div>
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>GST Number</p>
                  <p style={{ fontWeight: '600', margin: 0 }}>{companyInfo.gstNumber}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;