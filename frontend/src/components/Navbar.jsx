import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ShoppingBag, LogOut, Award, Lightbulb, Wallet, User as UserIcon, Menu } from 'lucide-react';
import { getRoleLabel } from '../utils/roleRouting';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { getCartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-surface border-b border-outline/10 sticky top-0 z-40 px-4 py-3 md:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Branding */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl font-bold">restaurant_menu</span>
            <span className="font-headline font-bold text-lg text-primary tracking-tight uppercase hidden md:inline">
              Restaurant POS
            </span>
          </Link>
        </div>

        {/* Navigation Links - Student Role Only */}
        {['user', 'customer'].includes(user.role) && (
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/dashboard"
              className={`font-semibold text-sm transition-colors ${
                isActive('/dashboard') ? 'text-primary' : 'text-secondary hover:text-primary'
              }`}
            >
              Menu
            </Link>
            <Link
              to="/wallet"
              className={`font-semibold text-sm flex items-center gap-1.5 transition-colors ${
                isActive('/wallet') ? 'text-primary' : 'text-secondary hover:text-primary'
              }`}
            >
              <Wallet size={16} />
              Wallet
            </Link>
            <Link
              to="/ideas"
              className={`font-semibold text-sm flex items-center gap-1.5 transition-colors ${
                isActive('/ideas') ? 'text-primary' : 'text-secondary hover:text-primary'
              }`}
            >
              <Lightbulb size={16} />
              Ideas
            </Link>
            <Link
              to="/wrapped"
              className={`font-semibold text-sm flex items-center gap-1.5 transition-colors ${
                isActive('/wrapped') ? 'text-primary' : 'text-secondary hover:text-primary'
              }`}
            >
              <Award size={16} />
              Wrapped
            </Link>
          </div>
        )}

        {/* Right Section Actions */}
        <div className="flex items-center gap-4">
          {/* User Balance Display (Student Only) */}
          {['user', 'customer'].includes(user.role) && (
            <div className="bg-primary/5 border border-primary/10 rounded-full px-3 py-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-sm font-semibold">payments</span>
              <span className="font-headline text-xs font-bold text-primary">
                ₹{user.wallet_balance.toFixed(2)}
              </span>
            </div>
          )}

          {/* Cart Icon (Student Only) */}
          {['user', 'customer'].includes(user.role) && (
            <Link to="/cart" className="relative p-2 text-secondary hover:text-primary transition-colors">
              <ShoppingBag size={20} />
              {getCartCount() > 0 && (
                <span className="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {getCartCount()}
                </span>
              )}
            </Link>
          )}

          {/* Profile Name & Signout */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant hidden sm:inline uppercase">
              {getRoleLabel(user.role)} - {user.roll_no}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 text-secondary hover:text-error transition-colors rounded-full hover:bg-error/5"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
