import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CustomersListPage from './pages/CustomersListPage.jsx';
import CustomerCreatePage from './pages/CustomerCreatePage.jsx';
import CustomerDetailPage from './pages/CustomerDetailPage.jsx';
import CustomerEditPage from './pages/CustomerEditPage.jsx';
import PlotsListPage from './pages/PlotsListPage.jsx';
import PlotCreatePage from './pages/PlotCreatePage.jsx';
import PlotDetailPage from './pages/PlotDetailPage.jsx';
import PlotEditPage from './pages/PlotEditPage.jsx';
import PaymentsListPage from './pages/PaymentsListPage.jsx';
import RecordPaymentPage from './pages/RecordPaymentPage.jsx';
import PaymentDetailPage from './pages/PaymentDetailPage.jsx';
import CategoryPage from './pages/CategoryPage.jsx';
import { RequireAuth } from './routes/RequireAuth.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersListPage />} />
        <Route path="/customers/new" element={<CustomerCreatePage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
        <Route path="/plots" element={<PlotsListPage />} />
        <Route path="/plots/new" element={<PlotCreatePage />} />
        <Route path="/plots/:id" element={<PlotDetailPage />} />
        <Route path="/plots/:id/edit" element={<PlotEditPage />} />
        <Route path="/payments" element={<PaymentsListPage />} />
        <Route path="/payments/new" element={<RecordPaymentPage />} />
        <Route path="/payments/:id" element={<PaymentDetailPage />} />
        <Route path="/categories" element={<CategoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
