import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Receipt, RefreshCw, BarChart2, Folder, Coffee, Users, ShieldAlert, Sliders } from 'lucide-react';
import { getRoleLabel } from '../utils/roleRouting';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || ['user', 'customer', 'external', 'dept'].includes(user.role)) return null;

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-64 bg-surface border-r border-outline/10 h-[calc(100vh-57px)] sticky top-[57px] hidden md:block py-6 px-4">
      <div className="space-y-6">
        
        {/* Cashier Sidebar Layout */}
        {user.role === 'cashier' && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider px-3 mb-2">Service desk</p>
            <Link
              to="/cashier/billing"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/cashier/billing') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <LayoutDashboard size={18} />
              Billing
            </Link>
            <Link
              to="/cashier/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/cashier/dashboard') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Receipt size={18} />
              Overview
            </Link>
            {['cashier', 'inventory_manager', 'admin', 'superadmin'].includes(user.role) && (
              <Link
                to="/cashier/stock"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive('/cashier/stock') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                }`}
              >
                <RefreshCw size={18} />
                Stock update
              </Link>
            )}
          </div>
        )}

        {user.role === 'chef' && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider px-3 mb-2">Kitchen</p>
            <Link
              to="/kitchen"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/kitchen') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
              }`}
            >
              <Coffee size={18} />
              KDS
            </Link>
          </div>
        )}

        {/* Admin Sidebar Layout */}
        {['admin', 'superadmin', 'inventory_manager'].includes(user.role) && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider px-3 mb-2">{getRoleLabel(user.role)}</p>
            {['admin', 'superadmin'].includes(user.role) && (
              <Link
                to="/admin/dashboard"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive('/admin/dashboard') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                }`}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </Link>
            )}
            {['admin', 'superadmin', 'inventory_manager'].includes(user.role) && (
              <Link
                to="/admin/items"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive('/admin/items') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                }`}
              >
                <Coffee size={18} />
                Items
              </Link>
            )}
            {['admin', 'superadmin'].includes(user.role) && (
              <>
                <Link
                  to="/admin/categories"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/admin/categories') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <Folder size={18} />
                  Categories
                </Link>
                <Link
                  to="/admin/users"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/admin/users') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <Users size={18} />
                  Users
                </Link>
                <Link
                  to="/admin/system"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/admin/system') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <Sliders size={18} />
                  System
                </Link>
                <Link
                  to="/admin/audit-logs"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/admin/audit-logs') ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <ShieldAlert size={18} />
                  Audit logs
                </Link>
              </>
            )}
          </div>
        )}

      </div>
    </aside>
  );
};

export default Sidebar;
