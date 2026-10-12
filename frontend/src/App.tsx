import { Navigate, Route, Routes } from 'react-router-dom';
import { OnboardingScreen } from './components/Auth/OnboardingScreen';
import { CanvasPage } from './components/Canvas/CanvasPage';
import { ProtectedRoute, PublicOnlyRoute } from './components/Common/ProtectedRoute';
import { SettingsPage } from './components/Settings/SettingsPage';
import { PricingPage } from './pages/PricingPage';
import { VerifyPage } from './pages/VerifyPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnlyRoute><OnboardingScreen /></PublicOnlyRoute>} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
