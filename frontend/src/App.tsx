import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { RequireRole } from './guards/RouteGuard';

import Login from './pages/Login';
import AgentLayout from './pages/agent/AgentLayout';
import NewVisit from './pages/agent/NewVisit';
import AgentProfile from './pages/agent/Profile';
import ManagerLayout from './pages/manager/ManagerLayout';
import AllVisits from './pages/manager/AllVisits';
import UserManagement from './pages/manager/UserManagement';
import AuditLogs from './pages/manager/AuditLogs';
import ManagerProfile from './pages/manager/Profile';

function RootRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'field_agent') return <Navigate to="/agent/new-visit" replace />;
  return <Navigate to="/manager/visits" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Field Agent Routes */}
          <Route
            path="/agent"
            element={
              <RequireRole role="field_agent">
                <AgentLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="new-visit" replace />} />
            <Route path="new-visit" element={<NewVisit />} />
            <Route path="profile" element={<AgentProfile />} />
          </Route>

          {/* Collection Manager Routes */}
          <Route
            path="/manager"
            element={
              <RequireRole role="collection_manager">
                <ManagerLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="visits" replace />} />
            <Route path="visits" element={<AllVisits />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="profile" element={<ManagerProfile />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
