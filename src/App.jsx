import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ProtectedRoute from './components/common/ProtectedRoute';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';

// Company Components
import CompanySetup from './components/company/CompanySetup';

// Dashboard
import Dashboard from './components/dashboard/Dashboard';

// Existing Components
import InvoiceGenerator from './components/invoice/InvoiceGenerator';
import DistanceDashboard from './components/travel/DistanceDashboard';

import './App.css';

function App() {
  const [travelCostItem, setTravelCostItem] = useState(null);

  const handleAddToInvoice = (item) => {
    setTravelCostItem(item);
  };

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/setup-company"
            element={
              <ProtectedRoute>
                <CompanySetup />
              </ProtectedRoute>
            }
          />

          <Route
            path="/invoice"
            element={
              <ProtectedRoute>
                <InvoiceGenerator travelCostItem={travelCostItem} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/travel"
            element={
              <ProtectedRoute>
                <DistanceDashboard onAddToInvoice={handleAddToInvoice} />
              </ProtectedRoute>
            }
          />

          {/* Default Route - redirect to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;