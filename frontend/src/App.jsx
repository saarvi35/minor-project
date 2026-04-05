import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";

const ManagerDashboardPage = lazy(() => import("./pages/ManagerDashboardPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const SetPasswordPage = lazy(() => import("./pages/SetPasswordPage"));
const TaskDetailsPage = lazy(() => import("./pages/TaskDetailsPage"));
const ProjectDetailsPage = lazy(() => import("./pages/ProjectDetailsPage"));
const UserDetailsPage = lazy(() => import("./pages/UserDetailsPage"));
const HomePage = lazy(() => import("./pages/HomePage"));

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

function GuestRoute({ children }) {
  const { token } = useAuth();
  return token ? <Navigate to="/app" replace /> : children;
}

function PageLoader() {
  return <main className="min-h-screen bg-slate-100 p-6 text-sm text-slate-600">Loading...</main>;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public homepage */}
          <Route path="/" element={<GuestRoute><HomePage /></GuestRoute>} />

          {/* Auth pages — redirect to dashboard if already logged in */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/set-password/:token" element={<SetPasswordPage />} />

          {/* Protected pages */}
          <Route path="/app" element={<ProtectedRoute><ManagerDashboardPage /></ProtectedRoute>} />
          <Route path="/task/:taskId" element={<ProtectedRoute><TaskDetailsPage /></ProtectedRoute>} />
          <Route path="/project/:projectId" element={<ProtectedRoute><ProjectDetailsPage /></ProtectedRoute>} />
          <Route path="/user/:userId" element={<ProtectedRoute><UserDetailsPage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
