import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Auth Pages
import Login from './pages/Login';

// Admin Pages
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminCoupons from './pages/Admin/Coupons';
import AdminTableMonitor from './pages/Admin/TableMonitor';
import AdminFloorSetup from './pages/Admin/FloorSetup';
import AdminSettings from './pages/Admin/Settings';
import AdminReports from './pages/Admin/Reports';

// Cashier Pages
import CashierTables from './pages/Cashier/Tables';
import CashierOrderScreen from './pages/Cashier/OrderScreen';
import CashierOrdersList from './pages/Cashier/OrdersList';
import CashierCustomers from './pages/Cashier/Customers';
import KitchenDisplay from './pages/Kitchen/KitchenDisplay';
import SelfOrder from './pages/Customer/SelfOrder';

// Inventory Pages
import InventoryDashboard from './pages/Inventory/Dashboard';
import InventoryItems from './pages/Inventory/Items';
import InventoryCategories from './pages/Inventory/Categories';
import InventoryStock from './pages/Inventory/Stock';

import './index.css';

// ─── Loading Screen ──────────────────────────────────────────────────────────
const LoadingScreen = ({ label = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-surface text-secondary">
    <div className="flex flex-col items-center gap-4">
      <span className="material-symbols-outlined text-primary text-5xl animate-pulse">restaurant_menu</span>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  </div>
);

// ─── Root Redirect ────────────────────────────────────────────────────────────
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const role = user.role_name;
  if (role === 'superadmin') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'cashier') return <Navigate to="/cashier/tables" replace />;
  if (role === 'inventory_manager') return <Navigate to="/inventory/dashboard" replace />;
  if (role === 'chef') return <Navigate to="/kds" replace />;
  return <Navigate to="/login" replace />;
};

// ─── Route Guard: require login ───────────────────────────────────────────────
const RequireAuth = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// ─── Route Guard: require role ────────────────────────────────────────────────
const RequireRole = ({ allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role_name)) return <Navigate to="/" replace />;
  return <Outlet />;
};

// ─── App Shell with responsive layout ────────────────────────────────────────
const AppShell = () => (
  <div className="min-h-screen bg-surface text-on-surface">
    <Navbar />
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-0">
        <Outlet />
      </main>
    </div>
  </div>
);

// ─── KDS Placeholder ─────────────────────────────────────────────────────────
const KDSPage = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 text-center">
    <span className="material-symbols-outlined text-primary text-6xl mb-4 block">kitchen</span>
    <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Kitchen Display System</h1>
    <p className="text-secondary">KDS view — coming soon. Orders sent to kitchen will appear here.</p>
  </div>
);

// ─── 404 Page ─────────────────────────────────────────────────────────────────
const NotFound = () => (
  <div className="max-w-xl mx-auto px-4 py-16 text-center">
    <span className="material-symbols-outlined text-outline text-7xl mb-4 block">search_off</span>
    <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Page Not Found</h1>
    <p className="text-secondary mb-6">This page doesn't exist or hasn't been built yet.</p>
    <a href="/" className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
      <span className="material-symbols-outlined text-base">home</span>
      Back to Home
    </a>
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/self-order/:tableId" element={<SelfOrder />} />

          {/* Protected routes */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>

              {/* Root redirects based on role */}
              <Route path="/" element={<RootRedirect />} />

              {/* ── Superadmin routes ─── */}
              <Route element={<RequireRole allowedRoles={['superadmin']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/coupons" element={<AdminCoupons />} />
                <Route path="/admin/tables" element={<AdminTableMonitor />} />
                <Route path="/admin/floors" element={<AdminFloorSetup />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/reports" element={<AdminReports />} />
              </Route>

              {/* ── Cashier routes ─── */}
              <Route element={<RequireRole allowedRoles={['cashier']} />}>
                <Route path="/cashier/tables" element={<CashierTables />} />
                <Route path="/cashier/order/:tableId" element={<CashierOrderScreen />} />
                <Route path="/cashier/orders" element={<CashierOrdersList />} />
                <Route path="/cashier/customers" element={<CashierCustomers />} />
              </Route>

              {/* ── Inventory Manager routes ─── */}
              <Route element={<RequireRole allowedRoles={['inventory_manager']} />}>
                <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
                <Route path="/inventory/items" element={<InventoryItems />} />
                <Route path="/inventory/categories" element={<InventoryCategories />} />
                <Route path="/inventory/stock" element={<InventoryStock />} />
              </Route>

              {/* ── Chef / KDS routes ─── */}
              <Route element={<RequireRole allowedRoles={['chef']} />}>
                <Route path="/kds" element={<KitchenDisplay />} />
              </Route>

            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
