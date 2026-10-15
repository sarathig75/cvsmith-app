import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { startSessionKeepAlive } from './services/session';
import { useAuthStore } from './store/authStore';
import { OnboardingScreen } from './components/Auth/OnboardingScreen';
import { CanvasPage } from './components/Canvas/CanvasPage';
import { ProtectedRoute, PublicOnlyRoute } from './components/Common/ProtectedRoute';
import { SettingsPage } from './components/Settings/SettingsPage';
import { PricingPage } from './pages/PricingPage';

export default function App() {
  // While logged in, activity keeps the session alive; 7 days without activity end it.
  const loggedIn = useAuthStore((s) => !!s.token);
  useEffect(() => (loggedIn ? startSessionKeepAlive() : undefined), [loggedIn]);
  return (
    <Routes>
      <Route path="/" element={<PublicOnlyRoute><OnboardingScreen /></PublicOnlyRoute>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
