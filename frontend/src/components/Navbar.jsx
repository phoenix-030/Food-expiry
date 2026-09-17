import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, X, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/useAuth';
import freshTrackLogo from '../assets/logoo.svg';

const Navbar = ({ searchValue, onSearchChange, placeholder = 'Search inventory...' }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentUser, logout } = useAuth();
  const searchInputRef = useRef(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const translatedPlaceholder = placeholder === 'Search inventory...' ? t('searchInventory') : placeholder;

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const [localSearch, setLocalSearch] = useState('');
  const currentSearchVal = searchValue !== undefined ? searchValue : localSearch;

  return (
    <header className="navbar-header">

      <div 
        className="navbar-brand-lockup" 
        aria-label="FreshTrack Home"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/dashboard')}
        onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard'); }}
        style={{ cursor: 'pointer' }}
      >
        <img src={freshTrackLogo} alt="" className="navbar-brand-logo" />
        <span className="navbar-brand-name">FreshTrack</span>
      </div>

      {/* Search Input Area */}
      <div className="navbar-search-container">
        <Search size={18} className="navbar-search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="navbar-search-input"
          aria-label={translatedPlaceholder}
          placeholder={translatedPlaceholder}
          value={currentSearchVal}
          onChange={(e) => {
            if (onSearchChange) {
              onSearchChange(e.target.value);
            } else {
              setLocalSearch(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const q = currentSearchVal.trim();
              if (q) {
                navigate(`/products?search=${encodeURIComponent(q)}`);
              }
            }
          }}
        />
        {currentSearchVal ? (
          <button
            type="button"
            className="navbar-search-clear"
            onClick={() => {
              if (onSearchChange) onSearchChange('');
              setLocalSearch('');
            }}
            aria-label="Clear search"
            title="Clear search"
          >
            <X size={15} />
          </button>
        ) : (
          <span className="navbar-search-shortcut" aria-hidden="true">Ctrl K</span>
        )}
      </div>

      {/* Notifications */}
      <div className="navbar-actions">
        <button className="navbar-icon-btn" onClick={() => navigate('/notifications')} aria-label={t('notifications')}>
          <Bell size={20} />
          <span className="navbar-badge-dot"></span>
        </button>
        {currentUser && (
          <div className="navbar-profile-menu">
            <button
              type="button"
              className="navbar-profile-button"
              onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
              aria-label="Open profile menu"
              aria-expanded={isProfileOpen}
            >
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.name} className="navbar-profile-avatar" />
              ) : (
                <span className="navbar-profile-avatar navbar-profile-initials">
                  {currentUser.name ? currentUser.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                </span>
              )}
            </button>
            {isProfileOpen && (
              <div className="navbar-profile-dropdown">
                <strong>{currentUser.name || 'User'}</strong>
                <button type="button" onClick={() => navigate('/settings')}>
                  Profile settings
                </button>
                <button type="button" onClick={async () => { await logout(); navigate('/'); }}>
                  <LogOut size={15} />
                  <span>{t('logout')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
