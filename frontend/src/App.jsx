import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AddEntry from './pages/AddEntry.jsx';
import Transactions from './pages/Transactions.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Partners from './pages/Partners.jsx';
import PartnerDetail from './pages/PartnerDetail.jsx';
import Categories from './pages/Categories.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';
import Approvals from './pages/Approvals.jsx';
import NotFound from './pages/NotFound.jsx';
import { ROLES } from './utils/constants.js';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="entries/new"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <AddEntry />
                </ProtectedRoute>
              }
            />
            <Route path="transactions" element={<Transactions />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:publicId" element={<CustomerDetail />} />
            <Route path="partners" element={<Partners />} />
            <Route path="partners/:publicId" element={<PartnerDetail />} />
            <Route path="categories" element={<Categories />} />
            <Route path="reports" element={<Reports />} />
            <Route
              path="settings"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <Audit />
                </ProtectedRoute>
              }
            />
            <Route
              path="approvals"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <Approvals />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}