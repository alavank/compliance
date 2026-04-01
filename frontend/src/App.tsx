import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getDefaultRoute, hasPermission } from './lib/access';
import Layout from './components/Layout';
import Login from './pages/Login';
import Passwords from './pages/Passwords';
import Dashboard from './pages/Dashboard';
import UsersAdmin from './pages/UsersAdmin';
import Groups from './pages/Groups';
import Terms from './pages/Terms';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Realtime from './pages/Realtime';
import Organization from './pages/Organization';
import PasswordRequests from './pages/PasswordRequests';
import Vaults from './pages/Vaults';
import KnowledgeBase from './pages/KnowledgeBase';
import CMDB from './pages/CMDB';
import Onboarding from './pages/Onboarding';
import Compliance from './pages/Compliance';

function PrivateRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-vault-400 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (permission && !hasPermission(user, permission)) return <Navigate to={getDefaultRoute(user)} replace />;
  return <Layout>{children}</Layout>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-vault-400 border-t-transparent rounded-full animate-spin" /></div>;
  return <Navigate to={getDefaultRoute(user)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/passwords" element={<PrivateRoute permission="passwords.view"><Passwords /></PrivateRoute>} />
          <Route path="/password-requests" element={<PrivateRoute><PasswordRequests /></PrivateRoute>} />
          <Route path="/admin/dashboard" element={<PrivateRoute permission="dashboard.view"><Dashboard /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute permission="users.manage"><UsersAdmin /></PrivateRoute>} />
          <Route path="/admin/groups" element={<PrivateRoute permission="groups.manage"><Groups /></PrivateRoute>} />
          <Route path="/admin/terms" element={<PrivateRoute permission="terms.manage"><Terms /></PrivateRoute>} />
          <Route path="/admin/logs" element={<PrivateRoute permission="audit_logs.view"><AuditLogs /></PrivateRoute>} />
          <Route path="/admin/realtime" element={<PrivateRoute permission="realtime.view"><Realtime /></PrivateRoute>} />
          <Route path="/admin/organizations" element={<PrivateRoute permission="organizations.manage"><Organization /></PrivateRoute>} />
          <Route path="/vaults" element={<PrivateRoute permission="vaults.view"><Vaults /></PrivateRoute>} />
          <Route path="/kb" element={<PrivateRoute permission="kb.view"><KnowledgeBase /></PrivateRoute>} />
          <Route path="/cmdb" element={<PrivateRoute permission="cmdb.view"><CMDB /></PrivateRoute>} />
          <Route path="/onboarding" element={<PrivateRoute permission="onboarding.view"><Onboarding /></PrivateRoute>} />
          <Route path="/compliance" element={<PrivateRoute permission="compliance.view"><Compliance /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
