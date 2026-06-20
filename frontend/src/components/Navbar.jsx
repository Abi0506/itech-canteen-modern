import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Menu, X, LayoutDashboard, RefreshCw, BarChart2, Folder, Coffee, Users, Sliders, MapPin, Percent, Layers, Landmark } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  // Get navigation links based on user role
  const getNavLinks = () => {
    if (user.role_name === 'cashier') {
      return [
        { to: '/cashier/tables', label: 'Tables Grid', icon: <Landmark size={18} /> },
      ];
    }
    if (user.role_name === 'inventory_manager') {
      return [
        { to: '/inventory/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { to: '/inventory/items', label: 'Products CRUD', icon: <Coffee size={18} /> },
        { to: '/inventory/categories', label: 'Categories', icon: <Folder size={18} /> },
        { to: '/inventory/stock', label: 'Stock Adjustments', icon: <RefreshCw size={18} /> },
      ];
    }
    if (user.role_name === 'superadmin') {
      return [
        { to: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { to: '/admin/users', label: 'Users & Staff', icon: <Users size={18} /> },
        { to: '/admin/coupons', label: 'Coupons & Promos', icon: <Percent size={18} /> },
        { to: '/admin/tables', label: 'Table Monitor', icon: <Layers size={18} /> },
        { to: '/admin/floors', label: 'Floors & Tables', icon: <MapPin size={18} /> },
        { to: '/admin/settings', label: 'Venue Settings', icon: <Sliders size={18} /> },
        { to: '/admin/reports', label: 'Reports & Charts', icon: <BarChart2 size={18} /> },
      ];
    }
    return [];
  };

  const navLinks = getNavLinks();

  return (
    <>
      <nav className="bg-surface border-b border-outline/10 sticky top-0 z-40 px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Branding & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            {navLinks.length > 0 && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-secondary hover:text-primary transition-colors rounded-lg hover:bg-surface-container-high md:hidden"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            )}
            
            <Link to="/" className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl font-bold">restaurant_menu</span>
              <span className="font-headline font-bold text-lg text-primary tracking-tight uppercase">
                Cafe Odoo
              </span>
            </Link>
          </div>

          {/* Right Section Actions */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline/5">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {user.name} ({user.role_name})
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-secondary hover:text-error transition-colors rounded-full hover:bg-error/5 hidden md:inline-flex"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && navLinks.length > 0 && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div className={`fixed top-[57px] left-0 w-72 bg-surface h-[calc(100vh-57px)] border-r border-outline/10 z-40 transform transition-transform duration-300 ease-in-out md:hidden ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full py-6 px-4 justify-between">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider px-3 mb-2">Navigation</p>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive(link.to) ? 'bg-primary/5 text-primary' : 'text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-outline/10 pt-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-error hover:bg-error/5 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
