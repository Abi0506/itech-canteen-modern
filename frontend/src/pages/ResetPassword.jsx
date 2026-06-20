import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Eye, EyeOff, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';

const CONSTRAINTS = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number (0-9)', test: (p) => /\d/.test(p) },
  { label: 'One special character (!@#…)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // Redirect to forgot-password if token is missing
  useEffect(() => {
    if (!token) {
      navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate]);

  const allPassed = CONSTRAINTS.every((c) => c.test(password));
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit = allPassed && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface font-body">
      {/* Left hero */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-surface-container-high">
        <img
          crossOrigin="anonymous"
          alt="Cafe interior"
          className="absolute inset-0 w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-16 left-12 right-12 text-white z-10">
          <p className="font-headline text-4xl xl:text-5xl leading-snug mb-4 font-bold">
            "A fresh start,<br/>secure and simple."
          </p>
          <p className="font-body text-sm uppercase tracking-[0.2em] opacity-70">Cafe Odoo System</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-md space-y-8">

          {/* Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-2">
              <ShieldCheck className="text-primary" size={32} />
            </div>
            <h1 className="font-headline text-3xl tracking-tight text-on-surface font-bold">Set New Password</h1>
            <p className="font-body text-secondary text-sm">
              Choose a strong password for your Cafe Odoo staff account.
            </p>
          </div>

          {/* Success state */}
          {done ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                <CheckCircle className="text-emerald-500" size={44} />
                <div>
                  <p className="font-semibold text-emerald-800 text-base">Password changed!</p>
                  <p className="text-emerald-700 text-sm mt-1">
                    Your password has been updated. You can now sign in with your new credentials.
                  </p>
                </div>
              </div>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-all text-sm tracking-wide"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200" role="alert">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                    <Link to="/forgot-password" className="text-xs text-primary font-semibold underline mt-1 inline-block">
                      Request a new reset link
                    </Link>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant" htmlFor="reset-password">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/50 text-xl">lock</span>
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Enter new password"
                      className="w-full pl-12 pr-14 py-4 bg-surface-container-low border-2 border-outline/20 rounded-xl focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-outline/40"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  {/* Strength checklist */}
                  {password.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {CONSTRAINTS.map((c) => {
                        const ok = c.test(password);
                        return (
                          <li key={c.label} className={`flex items-center gap-2 text-xs font-medium ${ok ? 'text-emerald-600' : 'text-outline'}`}>
                            <span className={`inline-block w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] font-bold
                              ${ok ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-outline/40 text-transparent'}`}>
                              ✓
                            </span>
                            {c.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant" htmlFor="reset-confirm">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/50 text-xl">lock</span>
                    <input
                      id="reset-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Re-enter new password"
                      className={`w-full pl-12 pr-14 py-4 bg-surface-container-low border-2 rounded-xl focus:outline-none transition-all text-on-surface placeholder:text-outline/40 ${
                        confirm.length > 0
                          ? passwordsMatch
                            ? 'border-emerald-400 focus:border-emerald-500'
                            : 'border-red-300 focus:border-red-400'
                          : 'border-outline/20 focus:border-primary'
                      }`}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {confirm.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-500 font-medium">Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-wide"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 rounded-full border-2 border-on-primary border-t-transparent animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-outline/20 rounded-xl text-sm font-semibold text-secondary hover:border-primary/40 hover:text-primary transition-all"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
