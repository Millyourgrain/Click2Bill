import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ProtectedRoute from './components/common/ProtectedRoute';

// Auth
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import RegisterCustomer from './components/auth/RegisterCustomer';

// Company / Profile
import CompanySetup from './components/company/CompanySetup';

// Customers
import CustomerList from './components/customer/CustomerList';
import CustomerProfile from './components/customer/CustomerProfile';

// Schedule
import ServiceSchedule from './components/schedule/ServiceSchedule';

// Dashboard
import Dashboard from './components/dashboard/Dashboard';

// Invoice & Travel
import InvoiceGenerator from './components/invoice/InvoiceGenerator';
import DistanceDashboard from './components/travel/DistanceDashboard';

// Customer (payor) dashboard & invoice view
import CustomerDashboard from './components/customer/CustomerDashboard';
import CustomerProfileSetup from './components/customer/CustomerProfileSetup';
import CustomerInvoiceView from './components/customer/CustomerInvoiceView';
import HomeRedirect from './components/common/HomeRedirect';
import LandingOrRedirect from './components/common/LandingOrRedirect';

import './App.css';

function App() {
  const [travelCostItem, setTravelCostItem] = useState(null);

  const handleAddToInvoice = (item) => {
    setTravelCostItem(item);
  };

  const handleTravelCostConsumed = useCallback(() => setTravelCostItem(null), []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-customer" element={<RegisterCustomer />} />

          {/* Company (issuer) routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['worker', 'user', 'admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setup-company"
            element={
              <ProtectedRoute allowedRoles={['worker', 'user', 'admin']}>
                <CompanySetup />
              </ProtectedRoute>
            }
          />

          <Route path="/invoice" element={<ProtectedRoute allowedRoles={['worker', 'user', 'admin']}><InvoiceGenerator travelCostItem={travelCostItem} onTravelCostConsumed={handleTravelCostConsumed} /></ProtectedRoute>} />
          <Route path="/travel" element={<ProtectedRoute allowedRoles={['worker', 'user', 'admin']}><DistanceDashboard onAddToInvoice={handleAddToInvoice} /></ProtectedRoute>} />

          <Route path="/customers" element={<ProtectedRoute allowedRoles={['worker', 'user', 'admin']}><CustomerList /></ProtectedRoute>} />
          <Route path="/customers/new" element={<ProtectedRoute allowedRoles={['worker', 'user', 'admin']}><CustomerProfile /></ProtectedRoute>} />
          <Route path="/customers/:customerId" element={<ProtectedRoute allowedRoles={['worker', 'user', 'admin']}><CustomerProfile /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute allowedRoles={['worker', 'user', 'admin']}><ServiceSchedule /></ProtectedRoute>} />

          {/* Invoice recipient (customer role) routes */}
          <Route path="/customer-dashboard" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/customer-profile-setup" element={<ProtectedRoute allowedRoles={['customer']}><CustomerProfileSetup /></ProtectedRoute>} />
          <Route path="/customer/invoice/:invoiceId" element={<ProtectedRoute allowedRoles={['customer']}><CustomerInvoiceView /></ProtectedRoute>} />

          <Route path="/" element={<LandingOrRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;