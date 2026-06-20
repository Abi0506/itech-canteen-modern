import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getGoogleCredential } from '../utils/googleAuth';

const Login = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const role = await login(rollNo, password);
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'cashier') {
        navigate('/cashier/dashboard');
      } else if (role === 'dept') {
        navigate('/dashboard'); // or dept checkout
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please verify credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    try {
      const credential = await getGoogleCredential();
      const role = await loginWithGoogle(credential);
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'cashier') {
        navigate('/cashier/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-[100dvh] flex flex-col lg:flex-row relative z-10 font-body">
      
      {/* Decorative Floating Illustrations (Desktop Only) */}
      <div className="hidden lg:block fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top Right: Coffee */}
        <div className="absolute top-[15%] right-[5%] float-decoration" style={{ animation: 'float-slower 8s infinite ease-in-out' }}>
          <span className="material-symbols-outlined text-[120px] text-primary" style={{ fontVariationSettings: "'wght' 100, 'opsz' 48" }}>coffee</span>
        </div>
        {/* Mid Left: Burger */}
        <div className="absolute top-[40%] left-[5%] float-decoration" style={{ animation: 'float-faster 7s infinite ease-in-out', animationDelay: '1s' }}>
          <span className="material-symbols-outlined text-[100px] text-primary" style={{ fontVariationSettings: "'wght' 100, 'opsz' 48" }}>lunch_dining</span>
        </div>
        {/* Bottom Right: Menu */}
        <div className="absolute bottom-[20%] right-[8%] float-decoration" style={{ animation: 'float-slower 10s infinite ease-in-out', animationDelay: '2s' }}>
          <span className="material-symbols-outlined text-[140px] text-tertiary" style={{ fontVariationSettings: "'wght' 100, 'opsz' 48" }}>restaurant_menu</span>
        </div>
      </div>

      {/* Left Column: Hero Visual (hidden on mobile, shown on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-surface-container-high">
        <img
          crossOrigin="anonymous"
          alt="Campus canteen with fresh food"
          className="absolute inset-0 w-full h-full object-cover gentle-float"
          src="https://ik.imagekit.io/iendzfwgs/canteen_items/marios-gkortsilas-kbqXzS60oZ0-unsplash.jpg"
          loading="eager"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        {/* Text overlay */}
        <div className="absolute bottom-16 left-12 right-12 text-white z-10">
          <p className="font-headline text-4xl xl:text-5xl leading-snug mb-4">
            "Good food is the foundation<br />of genuine happiness."
          </p>
          <p className="font-body text-sm uppercase tracking-[0.2em] opacity-70">PSG iTech Campus Dining</p>
        </div>
      </div>

      {/* Right Column: Sign In Form */}
      <div className="auth-panel flex-1 flex flex-col items-center justify-start px-6 pt-8 pb-12 lg:py-8 lg:px-12 xl:px-20 bg-pattern bg-surface">
        
        <div className="w-full max-w-md space-y-6 md:space-y-8 mt-6 mb-8 lg:my-auto">
          {/* Logo / Branding */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-primary text-6xl">restaurant_menu</span>
            </div>
            <h1 className="hidden md:block font-headline text-xl md:text-2xl tracking-tight text-primary uppercase font-bold">
              psg institute of technology and applied research
            </h1>
            <h1 className="md:hidden font-headline text-3xl tracking-tight text-primary font-bold">iTech Canteen</h1>
            <p className="font-body text-secondary text-sm tracking-wide uppercase">Canteen System</p>
          </div>

          {/* Error message Toast */}
          {error && (
            <div className="toast-animate flex items-start gap-3 p-4 rounded-xl bg-error-container border border-error/10" role="alert">
              <AlertCircle className="text-error flex-shrink-0 mt-0.5" size={20} />
              <p className="text-on-error-container text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username/Roll Number */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant ml-1" htmlFor="roll_no">
                Roll Number or Email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/50">badge</span>
                <input
                  className="w-full pl-12 pr-5 py-4 bg-surface-container-low border-2 border-transparent rounded-lg focus:ring-0 focus:border-primary/30 focus:bg-surface-container-highest transition-all duration-300 placeholder:text-outline/40 text-on-surface hover:bg-surface-container-high"
                  id="roll_no"
                  type="text"
                  placeholder="e.g. 22IT001 or name@psgitech.ac.in"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="block text-xs font-semibold tracking-widest uppercase text-on-surface-variant" htmlFor="password">
                  Password
                </label>
                <Link to="/forgot-password" className="text-primary font-bold text-xs uppercase tracking-wider hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/50">lock</span>
                <input
                  className="w-full pl-12 pr-12 py-4 bg-surface-container-low border-2 border-transparent rounded-lg focus:ring-0 focus:border-primary/30 focus:bg-surface-container-highest transition-all duration-300 placeholder:text-outline/40 text-on-surface hover:bg-surface-container-high"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40 hover:text-primary transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-4 bg-primary text-on-primary font-semibold rounded-lg tracking-wide hover:bg-on-primary-fixed-variant active:scale-[0.98] transition-all duration-200 editorial-shadow flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              Sign In
            </button>
          </form>

          {/* Social login divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-outline/30"></div>
            <span className="flex-shrink-0 mx-4 text-on-surface-variant text-xs font-semibold uppercase tracking-wider">or sign in with</span>
            <div className="flex-grow border-t border-outline/30"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-4 bg-surface-container-highest text-on-surface font-semibold rounded-lg tracking-wide hover:bg-secondary-container active:scale-[0.98] transition-all duration-200 editorial-shadow flex items-center justify-center gap-3 border border-outline/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google Logo" className="w-5 h-5" />
            {googleLoading ? 'Connecting...' : 'Google'}
          </button>

          {/* Register link */}
          <footer className="text-center pt-2">
            <p className="text-secondary text-sm">
              Don't have an account?
              <Link className="font-bold text-primary ml-1 hover:underline underline-offset-4 decoration-primary-container" to="/register">
                Register here
              </Link>
            </p>
          </footer>

        </div>
      </div>
    </div>
  );
};

export default Login;
