import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, RefreshCw, BarChart2, Folder, Coffee, Users, Sliders, MapPin, Percent, Layers } from 'lucide-react';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || user.role_name === 'chef' || user.role_name === 'cashier') return null;

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-64 bg-surface border-r border-outline/10 h-[calc(100vh-57px)] sticky top-[57px] hidden md:block py-6 px-4">
      <div className="space-y-6">
        
        {/* Inventory Manager Sidebar Layout */}
        {user.role_name === 'inventory_manager' && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider px-3 mb-2">Inventory Manager</p>
            <Link
              to="/inventory/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/inventory/dashboard') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
            <Link
              to="/inventory/items"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/inventory/items') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Coffee size={18} />
              Products CRUD
            </Link>
            <Link
              to="/inventory/categories"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/inventory/categories') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Folder size={18} />
              Categories
            </Link>
            <Link
              to="/inventory/stock"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/inventory/stock') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <RefreshCw size={18} />
              Stock Adjustments
            </Link>
          </div>
        )}

        {/* Superadmin Sidebar Layout */}
        {user.role_name === 'superadmin' && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider px-3 mb-2">Superadmin Panel</p>
            <Link
              to="/admin/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/admin/dashboard') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
            <Link
              to="/admin/users"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/admin/users') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Users size={18} />
              Users & Staff
            </Link>
            <Link
              to="/admin/coupons"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/admin/coupons') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Percent size={18} />
              Coupons & Promos
            </Link>
            <Link
              to="/admin/tables"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/admin/tables') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Layers size={18} />
              Table Monitor
            </Link>
            <Link
              to="/admin/floors"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/admin/floors') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <MapPin size={18} />
              Floors & Tables
            </Link>
            <Link
              to="/admin/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/admin/settings') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Sliders size={18} />
              Venue Settings
            </Link>
            <Link
              to="/admin/reports"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/admin/reports') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <BarChart2 size={18} />
              Reports & Charts
            </Link>
          </div>
        )}

      </div>
    </aside>
  );
};

export default Sidebar;
