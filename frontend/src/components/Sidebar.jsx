import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { 
  LayoutGrid, 
  Scan, 
  Package, 
  Bell, 
  BarChart2, 
  Settings, 
  History as HistoryIcon,
} from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const menuItems = [
    { label: 'dashboard', path: '/dashboard', icon: LayoutGrid },
    { label: 'scanProduct', path: '/scanner', icon: Scan },
    { label: 'productInventory', path: '/products', icon: Package },
    { label: 'notifications', path: '/notifications', icon: Bell },
    { label: 'analytics', path: '/analytics', icon: BarChart2 },
    { label: 'settings', path: '/settings', icon: Settings },
    { label: 'history', path: '/history', icon: HistoryIcon },
  ];

  return (
    <aside className="sidebar-container">
      {/* Local Styles for Sidebar */}

      {/* Navigation Items */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={t(item.label)}
              aria-label={t(item.label)}
              onClick={() => navigate(item.path)}
            >
              <IconComponent size={20} strokeWidth={2.2} />
              <span>{t(item.label)}</span>
            </button>
          );
        })}
      </nav>

    </aside>
  );
};

export default Sidebar;
