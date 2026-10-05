import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { Mail, Lock, Eye, EyeOff, Leaf, ArrowRight } from 'lucide-react';
import '../styles/Login.module.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const showToast = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleNoticeOpen, setGoogleNoticeOpen] = useState(false);
  const [appleNoticeOpen, setAppleNoticeOpen] = useState(false);

  useEffect(() => {
    if (!googleNoticeOpen && !appleNoticeOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setGoogleNoticeOpen(false);
        setAppleNoticeOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [googleNoticeOpen, appleNoticeOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      showToast('Logged in successfully!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* Left split illustration */}
      <div className="login-left">
        <div className="brand-header">
          <div className="brand-logo-circle">
            <Leaf size={28} />
          </div>
          <span className="brand-name">FreshTrack</span>
        </div>

        <div className="hero-statement">
          <h2>Manage your pantry,<br /><span>minimize your waste.</span></h2>
          <p className="hero-description">
            The smart, eco-friendly way to track food freshness and organize your kitchen inventory with ease.
          </p>
        </div>

        <div className="social-proof">
          <div className="avatar-group">
            <img className="proof-avatar" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80" alt="User 1" />
            <img className="proof-avatar" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80" alt="User 2" />
            <img className="proof-avatar" src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80" alt="User 3" />
          </div>
          <span className="proof-text">Join 2,000+ eco-conscious households</span>
        </div>
      </div>

      {/* Right split form */}
      <div className="login-right">
        <div className="login-box">
          <div className="login-heading">
            <h3 className="login-title">Welcome To Fresh Tracker</h3>
            <p className="login-subtitle">Log in to manage your inventory</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="input-container">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  className="form-input has-icon"
                  placeholder="Enter the Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-container">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input has-icon has-right-icon"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="input-right-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember Me
              </label>
              <a href="#forgot" className="forgot-link">Forgot Password?</a>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              <span>{loading ? 'Logging in...' : 'Login'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="divider">OR</div>

          <div className="social-buttons">
            <button type="button" className="social-btn" onClick={() => setGoogleNoticeOpen(true)}>
              <img className="social-logo" src="https://unpkg.com/simple-icons@v9/icons/google.svg" alt="" />
              <span>Google</span>
            </button>
            <button type="button" className="social-btn" onClick={() => setAppleNoticeOpen(true)}>
              <img className="social-logo" src="https://unpkg.com/simple-icons@v9/icons/apple.svg" alt="" />
              <span>Apple</span>
            </button>
          </div>

          <div className="register-footer">
            Don't have an account? <Link to="/register" className="register-link">Register Now</Link>
          </div>
        </div>
      </div>

      {googleNoticeOpen && (
        <div
          className="auth-modal-backdrop"
          role="presentation"
          onClick={() => setGoogleNoticeOpen(false)}
        >
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-login-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="google-login-title">Google login is coming soon</h4>
            <p>Google OAuth has not been added yet. Please use your email and password to log in.</p>
            <button
              type="button"
              className="submit-btn auth-modal-button"
              onClick={() => setGoogleNoticeOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {appleNoticeOpen && (
        <div
          className="auth-modal-backdrop"
          role="presentation"
          onClick={() => setAppleNoticeOpen(false)}
        >
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apple-login-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="apple-login-title">Apple login is coming soon</h4>
            <p>Apple login has not been added yet. Please use your email and password to log in.</p>
            <button
              type="button"
              className="submit-btn auth-modal-button"
              onClick={() => setAppleNoticeOpen(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
