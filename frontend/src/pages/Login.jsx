import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getLandingPath } from '../utils/roleRouting';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const role = await login(email, password);
      navigate(getLandingPath(role, '/login'));
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface font-body">
      
      {/* Left Column: Hero Visual - Hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-surface-container-high">
        <img
          crossOrigin="anonymous"
          alt="Cafe with fresh food"
          className="absolute inset-0 w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        <div className="absolute bottom-16 left-12 right-12 text-white z-10">
          <p className="font-headline text-4xl xl:text-5xl leading-snug mb-4 font-bold">
            "Where every cup<br/>tells a story."
          </p>
          <p className="font-body text-sm uppercase tracking-[0.2em] opacity-70">Cafe Odoo System</p>
        </div>
      </div>

      {/* Right Column: Sign In Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-md space-y-8">
          {/* Logo / Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-2">
              <span className="material-symbols-outlined text-primary text-4xl">restaurant_menu</span>
            </div>
            <h1 className="font-headline text-3xl tracking-tight text-on-surface font-bold">Cafe Odoo</h1>
            <p className="font-body text-secondary text-sm tracking-wide uppercase">Staff Login Portal</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200" role="alert">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant" htmlFor="login-email">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/50 text-xl">mail</span>
                <input
                  className="w-full pl-12 pr-5 py-4 bg-surface-container-low border-2 border-outline/20 rounded-xl focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-outline/40"
                  id="login-email"
                  type="email"
                  pattern=".*@.*"
                  title="Please include an '@' in the email address."
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/50 text-xl">lock</span>
                <input
                  className="w-full pl-12 pr-14 py-4 bg-surface-container-low border-2 border-outline/20 rounded-xl focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-outline/40"
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-primary hover:underline underline-offset-2 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-wide"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 rounded-full border-2 border-on-primary border-t-transparent animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In to Cafe Odoo
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="bg-surface-container-low rounded-xl p-4 border border-outline/10">
            <p className="text-xs font-bold text-outline uppercase tracking-wider mb-3">Demo Credentials</p>
            <div className="space-y-2 text-xs text-secondary">
              <div className="flex justify-between"><span className="font-semibold text-on-surface">Super Admin</span><span>superadmin@example.com / redwolf_8324</span></div>
              <div className="flex justify-between"><span className="font-semibold text-on-surface">Cashier</span><span>cashier@example.com / redwolf_8324</span></div>
              <div className="flex justify-between"><span className="font-semibold text-on-surface">Inventory Mgr</span><span>inventory@example.com / redwolf_8324</span></div>
              <div className="flex justify-between"><span className="font-semibold text-on-surface">Chef (KDS)</span><span>chef@example.com / redwolf_8324</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
