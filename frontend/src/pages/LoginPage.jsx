import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import toast from 'react-hot-toast';
import '../styles/auth.css';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    clearError();
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(formData.email, formData.password);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="auth-page">
      {/* Animated background orbs */}
      <div className="auth-bg">
        <div className="orb orb-1" aria-hidden="true" />
        <div className="orb orb-2" aria-hidden="true" />
        <div className="orb orb-3" aria-hidden="true" />
      </div>

      <div className="auth-container animate-fade-in-up">
        {/* Logo */}
        <div className="auth-logo">
          <div className="shield-icon">
            <Shield size={32} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="auth-brand">SecureVault</h1>
            <p className="auth-tagline">Client-Side Encrypted Storage</p>
          </div>
        </div>

        {/* Security indicator */}
        <div className="security-indicator" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <span className="security-dot" />
          AES-256 · Zero-Knowledge · End-to-End Encrypted
        </div>

        <div className="glass-card auth-card">
          <h2 className="auth-title">Sign In</h2>
          <p className="auth-subtitle">Your files never leave your device unencrypted.</p>

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="form-input input-with-icon"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Your encryption password"
                  className="form-input input-with-icon input-with-end-icon"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="input-end-btn"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label="Toggle visibility"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={isLoading}
              id="login-submit-btn"
            >
              {isLoading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Authenticating…
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In Securely
                </>
              )}
            </button>
          </form>

          <div className="divider">or</div>

          <p className="auth-switch">
            Don&apos;t have an account?{' '}
            <Link to="/register" id="go-to-register-link">Create one →</Link>
          </p>
        </div>

        <p className="auth-footer">
          Your password derives your encryption key. We never see it.
        </p>
      </div>
    </div>
  );
}
