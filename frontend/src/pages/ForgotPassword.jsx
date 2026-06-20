import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { ArrowLeft, Mail, CheckCircle, AlertCircle, Send } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface font-body">
      {/* Left hero panel */}
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
            "Account recovery<br/>made simple."
          </p>
          <p className="font-body text-sm uppercase tracking-[0.2em] opacity-70">Cafe Odoo System</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-md space-y-8">

          {/* Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-2">
              <span className="material-symbols-outlined text-primary text-4xl">lock_reset</span>
            </div>
            <h1 className="font-headline text-3xl tracking-tight text-on-surface font-bold">Forgot Password</h1>
            <p className="font-body text-secondary text-sm">
              Enter your staff email and we'll send you a reset link.
            </p>
          </div>

          {/* Success state */}
          {sent ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                <CheckCircle className="text-emerald-500" size={44} />
                <div>
                  <p className="font-semibold text-emerald-800 text-base">Check your inbox!</p>
                  <p className="text-emerald-700 text-sm mt-1">
                    If <strong>{email}</strong> is registered, a password reset link (valid 1 hour) has been sent.
                  </p>
                </div>
              </div>
              <p className="text-xs text-secondary text-center">
                Didn't receive it? Check your spam folder or{' '}
                <button
                  className="text-primary font-semibold underline underline-offset-2"
                  onClick={() => { setSent(false); setEmail(''); }}
                >
                  try again
                </button>
                .
              </p>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-outline/20 rounded-xl text-sm font-semibold text-secondary hover:border-primary/40 hover:text-primary transition-all"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200" role="alert">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label
                    className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant"
                    htmlFor="forgot-email"
                  >
                    Staff Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline/50" size={18} />
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Enter your registered email"
                      className="w-full pl-12 pr-5 py-4 bg-surface-container-low border-2 border-outline/20 rounded-xl focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-outline/40"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-wide"
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 rounded-full border-2 border-on-primary border-t-transparent animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Reset Link
                    </>
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

export default ForgotPassword;
