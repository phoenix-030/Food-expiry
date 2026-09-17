import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Mail, Lock, User, Leaf, ArrowRight, Eye, EyeOff } from 'lucide-react';
import '../styles/Register.module.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('Household Lead');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleNoticeOpen, setGoogleNoticeOpen] = useState(false);

  useEffect(() => {
    if (!googleNoticeOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setGoogleNoticeOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [googleNoticeOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(name, email, password, role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed.');
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
          <h2>Join the community,<br /><span>save food, save money.</span></h2>
          <p className="hero-description">
            Create an account to start tracking expiry dates, reducing waste, and generating eco-friendly cooking recommendations.
          </p>
        </div>

  
      </div>

      {/* Right split form */}
      <div className="login-right">
        <div className="login-box">
          <div className="login-heading">
            <h3 className="login-title">Register Account</h3>
            <p className="login-subtitle">Start organizing your smart kitchen</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-container">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  className="form-input has-icon"
                  placeholder="Enter Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="input-container">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  className="form-input has-icon"
                  placeholder="name@gmail.com"
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
                  placeholder="At least 6 characters"
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

            <div className="form-group">
              <label className="form-label">Household Role</label>
              <select
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Household Lead">Household Lead</option>
                <option value="Household Member">Household Member</option>
                <option value="Kitchen Manager">Kitchen Manager</option>
              </select>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              <span>{loading ? 'Creating Account...' : 'Register'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="divider">OR</div>

          <button
            type="button"
            className="social-btn social-btn-full"
            onClick={() => setGoogleNoticeOpen(true)}
          >
            <img className="social-logo" src="https://unpkg.com/simple-icons@v9/icons/google.svg" alt="" />
            <span>Sign up with Google</span>
          </button>

          <div className="register-footer">
            Already have an account? <Link to="/" className="register-link">Log In</Link>
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
            aria-labelledby="google-signup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="google-signup-title">Google sign-up is coming soon</h4>
            <p>For now, create your FreshTrack account with your email and password.</p>
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
    </div>
  );
};

export default Register;
