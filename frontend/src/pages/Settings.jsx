import { useEffect, useState } from 'react';
import { Save, User, Upload, X, Moon, Sun, Globe } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/settings.css';

const Settings = () => {
  const { currentUser, updateProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [enableOpenFoodFacts, setEnableOpenFoodFacts] = useState(() => {
    return localStorage.getItem('freshtrack_enable_openfoodfacts') === 'true';
  });

  const handleToggleOpenFoodFacts = (checked) => {
    setEnableOpenFoodFacts(checked);
    localStorage.setItem('freshtrack_enable_openfoodfacts', checked ? 'true' : 'false');
    window.dispatchEvent(new Event('freshtrack_settings_updated'));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Please choose an image smaller than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setName(currentUser?.name || '');
    setEmail(currentUser?.email || '');
    setAvatarUrl(currentUser?.avatar_url || '');
  }, [currentUser]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await updateProfile({ name, email, avatar_url: avatarUrl });
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = name
    ? name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Navbar placeholder="Search inventory..." />
        <div className="page-container">
          <div className="card settings-card">
            <div className="settings-title-row">
              <div>
                <h3 className="panel-heading settings-heading">{t('settings')}</h3>
                <p className="panel-copy">{t('manageProfile')}</p>
              </div>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile preview" className="settings-avatar" />
              ) : (
                <div className="settings-avatar settings-avatar-fallback"><User size={22} /><span>{initials}</span></div>
              )}
            </div>

            <form className="settings-profile-form" onSubmit={handleSubmit}>
              {error && <p className="settings-message settings-message-error">{error}</p>}
              {message && <p className="settings-message settings-message-success">{message}</p>}

              <div className="settings-form-grid">
                <label className="form-group">
                  <span className="form-label">{t('fullName')}</span>
                  <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label className="form-group">
                  <span className="form-label">{t('emailAddress')}</span>
                  <input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
              </div>

              <div className="form-group">
                <span className="form-label">{t('profilePicture')}</span>
                <div className="settings-upload-row">
                  <label className="btn btn-secondary settings-upload-button">
                    <Upload size={16} />
                    <span>{avatarUrl ? t('changePicture') : t('choosePicture')}</span>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                  {avatarUrl && (
                    <button type="button" className="settings-remove-picture" onClick={() => setAvatarUrl('')}>
                      <X size={16} />
                      <span>{t('removePicture')}</span>
                    </button>
                  )}
                </div>
              </div>

              <label className="form-group">
                <span className="form-label">{t('language')}</span>
                <select className="form-input" value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="en">{t('english')}</option>
                  <option value="hi">{t('hindi')}</option>
                  <option value="ta">{t('tamil')}</option>
                </select>
              </label>

              <div className="form-group">
                <span className="form-label">Appearance</span>
                <div className="theme-switcher" role="group" aria-label="Choose appearance">
                  <button
                    type="button"
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                    aria-pressed={theme === 'light'}
                  >
                    <Sun size={16} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                    aria-pressed={theme === 'dark'}
                  >
                    <Moon size={16} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Scan & Database Preferences */}
              <div className="form-group" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px', marginTop: '16px' }}>
                <span className="form-label" style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  Scan & Database Integration
                </span>
                <p className="panel-copy" style={{ fontSize: '13px', margin: '4px 0 12px 0' }}>
                  Choose whether the global Open Food Facts database search & catalog appears in your Scanner section.
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: enableOpenFoodFacts ? 'rgba(6, 110, 56, 0.06)' : '#f8fafc',
                  border: `1px solid ${enableOpenFoodFacts ? '#86efac' : '#e2e8f0'}`,
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: enableOpenFoodFacts ? '#dcfce7' : '#e2e8f0',
                      color: enableOpenFoodFacts ? '#066e38' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Globe size={20} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b' }}>
                        Open Food Facts Database
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {enableOpenFoodFacts 
                          ? 'Active: The Open Food Facts Live Catalog is visible in the Scanner.' 
                          : 'Hidden: Turned off from the Scan Product section.'}
                      </span>
                    </div>
                  </div>

                  <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px', cursor: 'pointer', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={enableOpenFoodFacts}
                      onChange={(e) => handleToggleOpenFoodFacts(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                      aria-label="Toggle Open Food Facts Database"
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: enableOpenFoodFacts ? '#066e38' : '#cbd5e1',
                      borderRadius: '24px',
                      transition: '0.25s'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px',
                        width: '18px',
                        left: enableOpenFoodFacts ? '25px' : '3px',
                        bottom: '3px',
                        backgroundColor: '#ffffff',
                        borderRadius: '50%',
                        transition: '0.25s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>
              </div>

              <div className="settings-details">
                <div><strong>{t('role')}:</strong> {currentUser?.role || t('role')}</div>
              </div>

              <button className="btn btn-primary settings-save-button" type="submit" disabled={saving}>
                <Save size={16} />
                {saving ? t('saving') : t('saveProfile')}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
