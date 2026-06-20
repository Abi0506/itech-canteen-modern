import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getGoogleCredential } from '../utils/googleAuth';
import { getLandingPath } from '../utils/roleRouting';

const passwordRules = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'At least one uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'At least one number', test: (value) => /\d/.test(value) },
  { label: 'At least one special character', test: (value) => /[^A-Za-z0-9\s]/.test(value) },
];

const passwordConstraintMessage = 'Password must be at least 8 characters and contain one uppercase letter, one number, and one special character.';

const Register = () => {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [rollNo, setRollNo] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [constraintPopup, setConstraintPopup] = useState('');
  const passwordIsValid = passwordRules.every((rule) => rule.test(password));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!passwordIsValid) {
      setConstraintPopup(passwordConstraintMessage);
      setError(passwordConstraintMessage);
      return;
    }
    try {
      await register(rollNo, email, phoneNo, password, userType);
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please check inputs.');
    }
  };

  const closeConstraintPopup = () => setConstraintPopup('');

  const handleGoogleRegister = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    try {
      const credential = await getGoogleCredential();
      const authResult = await loginWithGoogle(credential);
      setSuccess('Google account connected successfully. Redirecting...');
      setTimeout(() => {
        navigate(authResult.landing_path || getLandingPath(authResult.role));
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Google sign-up failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-[100dvh] flex flex-col lg:flex-row relative z-10 font-body">
      
      {/* Left Column: Hero Visual (hidden on mobile, shown on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-surface-container-high">
        <img
          crossOrigin="anonymous"
          alt="Restaurant with fresh food"
          className="absolute inset-0 w-full h-full object-cover gentle-float"
          src="https://ik.imagekit.io/iendzfwgs/canteen_items/marios-gkortsilas-kbqXzS60oZ0-unsplash.jpg"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        <div className="absolute bottom-16 left-12 right-12 text-white z-10">
          <p className="font-headline text-4xl xl:text-5xl leading-snug mb-4">
            "Create access for the<br />restaurant experience."
          </p>
          <p className="font-body text-sm uppercase tracking-[0.2em] opacity-70">Restaurant Access Portal</p>
        </div>
      </div>

      {/* Right Column: Register Form */}
      <div className="auth-panel flex-1 flex flex-col items-center justify-start px-6 pt-8 pb-12 lg:py-8 lg:px-12 xl:px-20 bg-pattern bg-surface">
        
        <div className="w-full max-w-md space-y-6 md:space-y-8 mt-6 mb-8 lg:my-auto">
          <div className="text-center space-y-4">
            <h1 className="font-headline text-3xl tracking-tight text-primary font-bold">Create Account</h1>
            <p className="font-body text-secondary text-sm tracking-wide uppercase">Customer or Staff Access</p>
          </div>

          {error && (
            <div className="toast-animate flex items-start gap-3 p-4 rounded-xl bg-error-container border border-error/10" role="alert">
              <AlertCircle className="text-error flex-shrink-0 mt-0.5" size={20} />
              <p className="text-on-error-container text-sm font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="toast-animate flex items-start gap-3 p-4 rounded-xl bg-tertiary-container/20 border border-tertiary/10" role="alert">
              <span className="material-symbols-outlined text-tertiary flex-shrink-0 mt-0.5">check_circle</span>
              <p className="text-on-tertiary-container text-sm font-medium">{success}</p>
            </div>
          )}

          {constraintPopup && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl border border-outline/10 bg-surface p-5 shadow-2xl">
                <h3 className="font-headline text-lg font-bold text-on-surface">Password constraint not satisfied</h3>
                <p className="mt-2 text-sm text-secondary">{constraintPopup}</p>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={closeConstraintPopup}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/95"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* User Type Select */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant ml-1">
                Access Type
              </label>
              <select
                className="w-full px-4 py-3 bg-surface-container-low border-2 border-transparent rounded-lg focus:ring-0 focus:border-primary/30 text-on-surface hover:bg-surface-container-high"
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
              >
                <option value="customer">Customer</option>
                <option value="external">Staff</option>
                <option value="user">General User</option>
              </select>
            </div>

            {/* Roll Number */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant ml-1" htmlFor="roll_no">
                Username / ID
              </label>
              <input
                className="w-full px-4 py-3 bg-surface-container-low border-2 border-transparent rounded-lg focus:ring-0 focus:border-primary/30 text-on-surface hover:bg-surface-container-high"
                id="roll_no"
                type="text"
                placeholder="e.g. cashier01 or customer01"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant ml-1" htmlFor="email">
                Email Address
              </label>
              <input
                className="w-full px-4 py-3 bg-surface-container-low border-2 border-transparent rounded-lg focus:ring-0 focus:border-primary/30 text-on-surface hover:bg-surface-container-high"
                id="email"
                type="email"
                pattern=".*@.*"
                title="Please include an '@' in the email address."
                placeholder="e.g. email@psgitech.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant ml-1" htmlFor="phone">
                Phone Number
              </label>
              <input
                className="w-full px-4 py-3 bg-surface-container-low border-2 border-transparent rounded-lg focus:ring-0 focus:border-primary/30 text-on-surface hover:bg-surface-container-high"
                id="phone"
                type="tel"
                pattern="[0-9]{10}"
                maxLength="10"
                minLength="10"
                title="Phone number must be exactly 10 digits"
                placeholder="e.g. 9876543210"
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant ml-1" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full pl-4 pr-12 py-3 bg-surface-container-low border-2 border-transparent rounded-lg focus:ring-0 focus:border-primary/30 text-on-surface hover:bg-surface-container-high"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength="8"
                  pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}"
                  title={passwordConstraintMessage}
                  aria-describedby="password-requirements"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40 hover:text-primary transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div id="password-requirements" className="mt-2 grid gap-1 px-1">
                {passwordRules.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <p
                      key={rule.label}
                      className={`flex items-center gap-2 text-xs ${
                        passed ? 'text-emerald-700' : 'text-secondary'
                      }`}
                    >
                      <span aria-hidden="true">{passed ? '✓' : '○'}</span>
                      {rule.label}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!passwordIsValid}
              className="w-full py-4 bg-primary text-on-primary font-semibold rounded-lg tracking-wide hover:bg-on-primary-fixed-variant active:scale-[0.98] transition-all duration-200 editorial-shadow flex items-center justify-center gap-2 mt-4 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus size={20} />
              Register Account
            </button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-outline/30"></div>
            <span className="flex-shrink-0 mx-4 text-on-surface-variant text-xs font-semibold uppercase tracking-wider">or continue with</span>
            <div className="flex-grow border-t border-outline/30"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleRegister}
            disabled={googleLoading}
            className="w-full py-4 bg-surface-container-highest text-on-surface font-semibold rounded-lg tracking-wide hover:bg-secondary-container active:scale-[0.98] transition-all duration-200 editorial-shadow flex items-center justify-center gap-3 border border-outline/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google Logo" className="w-5 h-5" />
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <footer className="text-center pt-2">
            <p className="text-secondary text-sm">
              Already have an account?
              <Link className="font-bold text-primary ml-1 hover:underline" to="/login">
                Sign In instead
              </Link>
            </p>
          </footer>

        </div>
      </div>
    </div>
  );
};

export default Register;
