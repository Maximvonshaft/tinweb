import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { LoginPage } from '@/pages/LoginPage';
import { SharePage } from '@/pages/SharePage';
import { DrivePage } from '@/pages/DrivePage';
import { RecyclePage } from '@/pages/RecyclePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/stores/toast';

function ProtectedRoute() {
  const token = useAuthStore((state) => state.accessToken);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

function ShellRoutes() {
  const { dismiss } = useToast();
  const location = useLocation();

  useEffect(() => {
    // 离开页面时清理旧 toast，避免跨页面残留
    dismiss('__route');
  }, [location.pathname, dismiss]);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/drive" replace />} />
        <Route path="/drive" element={<DrivePage />} />
        <Route path="/recycle" element={<RecyclePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/share/:token" element={<SharePage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<ShellRoutes />} />
      </Route>
      <Route path="*" element={<Navigate to="/drive" replace />} />
    </Routes>
  );
}
