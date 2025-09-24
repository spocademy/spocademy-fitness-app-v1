// src/App.js
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginForm from './components/auth/LoginForm';
import Homepage from './components/dashboard/Homepage';
import AdminDashboard from './components/admin/AdminDashboard';
import './App.css';

function AppContent() {
  const { currentUser, userData, loading } = useAuth();

  // console.log('Current User:', currentUser); 
  // console.log('User Data:', userData);
  // console.log('Loading:', loading);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginForm />;
  }

  // Route based on user role
  console.log('User Data:', userData);
  console.log('Role:', userData?.role);

  if (userData?.role === 'admin') {
    return <AdminDashboard />;
  }

  return <Homepage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;