import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { getLandingPath, roleMatches } from './utils/roleRouting';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/Admin/Dashboard';
import Categories from './pages/Admin/Categories';
import Items from './pages/Admin/Items';
import CashierDashboard from './pages/Cashier/Dashboard';
import Billing from './pages/Cashier/Billing';
import Stock from './pages/Cashier/Stock';
import UserDashboard from './pages/User/Dashboard';
import Cart from './pages/User/Cart';
import IdeaBoard from './pages/User/IdeaBoard';
import Orders from './pages/User/Orders';
import Profile from './pages/User/Profile';
import Wallet from './pages/User/Wallet';
import Wrapped from './pages/User/Wrapped';
import KitchenDisplay from './pages/Kitchen/KitchenDisplay';
import CustomerDisplay from './pages/Customer/Display';
import SelfOrder from './pages/Customer/SelfOrder';
import './index.css';

const LoadingScreen = ({ label = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-surface text-secondary">
    <div className="flex items-center gap-3">
      <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  </div>
);

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getLandingPath(user.role)} replace />;
};

const RequireAuth = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const RequireRole = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roleMatches(user.role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const AppShell = () => (
  <div className="min-h-screen bg-surface text-on-surface">
    <Navbar />
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  </div>
);

const PlaceholderPage = ({ title, description }) => (
  <div className="max-w-3xl mx-auto px-4 py-16">
    <div className="rounded-3xl border border-outline/10 bg-surface-container-low p-8 md:p-10">
      <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-3">Restaurant POS</p>
      <h1 className="font-headline text-3xl md:text-4xl font-black text-on-surface mb-3">{title}</h1>
      <p className="text-secondary text-sm md:text-base leading-relaxed">{description}</p>
    </div>
  </div>
);

const MissingRoute = () => (
  <PlaceholderPage
    title="Page not available yet"
    description="This section is linked in the interface, but the page has not been implemented in the current workspace."
  />
);

const ForgotPassword = () => (
  <PlaceholderPage
    title="Reset password"
    description="Password recovery is not wired yet. Use the registration or login flow for now."
  />
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/customer-display/:tableId" element={<CustomerDisplay />} />
            <Route path="/self-order/:tableId" element={<SelfOrder />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/ideas" element={<IdeaBoard />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/wrapped" element={<Wrapped />} />

                <Route element={<RequireRole allowedRoles={[ 'admin', 'superadmin' ]} />}>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/users" element={<MissingRoute />} />
                  <Route path="/admin/system" element={<MissingRoute />} />
                  <Route path="/admin/audit-logs" element={<MissingRoute />} />
                </Route>

                <Route element={<RequireRole allowedRoles={[ 'admin', 'superadmin', 'inventory_manager' ]} />}>
                  <Route path="/admin/categories" element={<Categories />} />
                  <Route path="/admin/items" element={<Items />} />
                </Route>

                <Route element={<RequireRole allowedRoles={[ 'cashier', 'superadmin' ]} />}>
                  <Route path="/cashier/dashboard" element={<CashierDashboard />} />
                  <Route path="/cashier/billing" element={<Billing />} />
                </Route>

                <Route element={<RequireRole allowedRoles={[ 'cashier', 'inventory_manager', 'admin', 'superadmin' ]} />}>
                  <Route path="/cashier/stock" element={<Stock />} />
                </Route>

                <Route element={<RequireRole allowedRoles={[ 'chef' ]} />}>
                  <Route path="/kitchen" element={<KitchenDisplay />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
