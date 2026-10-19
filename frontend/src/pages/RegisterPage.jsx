import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, User, Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import toast from 'react-hot-toast';
import '../styles/auth.css';

// Compute password strength score (0-4)
const getStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[!@#$%^&*]/.test(pwd)) score++;
  return score;
};

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_CLASSES = ['', 'active-weak', 'active-fair', 'active-strong', 'active-strong'];

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const strength = getStrength(form.password);

  const handleChange = (e) => {
    clearError();
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (strength < 3) {
      toast.error('Please choose a stronger password.');
      return;
    }
    const result = await register(form.username, form.email, form.password);
    if (result.success) {
      toast.success('Account created! Welcome to SecureVault');
      navigate('/dashboard');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="orb orb-1" aria-hidden="true" />
        <div className="orb orb-2" aria-hidden="true" />
        <div className="orb orb-3" aria-hidden="true" />
      </div>

      <div className="auth-container animate-fade-in-up">
        <div className="auth-logo">
          <div className="shield-icon"><Shield size={32} strokeWidth={1.5} /></div>
          <div>
            <h1 className="auth-brand">SecureVault</h1>
            <p className="auth-tagline">Client-Side Encrypted Storage</p>
          </div>
        </div>

        <div className="security-indicator" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <span className="security-dot" />
          AES-256-GCM · PBKDF2-310k
        </div>

        <div className="glass-card auth-card">
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Your password is your key. Choose wisely.</p>

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Username</label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input id="reg-username" name="username" type="text" autoComplete="username"
                  required placeholder="johndoe" className="form-input input-with-icon"
                  value={form.username} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input id="reg-email" name="email" type="email" autoComplete="email"
                  required placeholder="you@example.com" className="form-input input-with-icon"
                  value={form.email} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Encryption Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input id="reg-password" name="password" type={showPass ? 'text' : 'password'}
                  autoComplete="new-password" required placeholder="Min 8 chars, uppercase, number, symbol"
                  className="form-input input-with-icon input-with-end-icon"
                  value={form.password} onChange={handleChange} />
                <button type="button" className="input-end-btn" onClick={() => setShowPass((v) => !v)}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength meter */}
              {form.password && (
                <>
                  <div className="strength-bar" role="meter" aria-valuenow={strength} aria-valuemax={4}>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`strength-segment ${i <= strength ? STRENGTH_CLASSES[strength] : ''}`}
                      />
                    ))}
                  </div>
                  <p className="strength-label">{STRENGTH_LABELS[strength]}</p>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input id="reg-confirm" name="confirm" type="password" autoComplete="new-password"
                  required placeholder="Re-enter password"
                  className={`form-input input-with-icon ${form.confirm && form.confirm !== form.password ? 'error' : ''}`}
                  value={form.confirm} onChange={handleChange} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}
              disabled={isLoading} id="register-submit-btn">
              {isLoading ? (
                <><span className="spinner" />Creating account…</>
              ) : (
                <><UserPlus size={18} />Create Secure Account</>
              )}
            </button>
          </form>

          <div className="divider">or</div>

          <p className="auth-switch">
            Already have an account? <Link to="/login" id="go-to-login-link">Sign in →</Link>
          </p>
        </div>

        <p className="auth-footer">
          If you lose your password, your files CANNOT be recovered. We hold no keys.
        </p>
      </div>
    </div>
  );
}
