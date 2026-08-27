import { useState } from 'react';
import { useTranslation } from '../i18n/translations';

export default function Sidebar({ active, onSelect }) {
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslation();

  const NAV_ITEMS = [
    { key: 'todos', label: t('todoList'), icon: '/icons/todo.png', iconSize: '2rem' },
    { key: 'calendar', label: t('calendar'), icon: '/icons/calendar.png' },
    { key: 'homework', label: t('homework'), icon: '/icons/homework.png' },
    { key: 'marks', label: t('marks'), icon: '/icons/subjects.png' },
    { key: 'subjects', label: t('subjects'), icon: '/icons/subjects.png' },
    { key: 'settings', label: t('settings'), icon: '/icons/settings.png' },
    { key: 'account', label: t('account'), icon: '/icons/account.png' }
  ];

  return (
    <div style={{ ...styles.sidebar, width: collapsed ? '64px' : '220px' }}>
      <button style={styles.toggle} onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
        <span style={styles.hamburger}>&#9776;</span>
      </button>

      <nav style={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            style={{
              ...styles.navItem,
              background: active === item.key ? 'var(--nav-active-bg)' : 'transparent'
            }}
          >
            <img
              src={item.icon}
              alt=""
              style={{
                ...styles.icon,
                ...(item.iconSize ? { width: item.iconSize, height: item.iconSize } : {})
              }}
            />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

const styles = {
  sidebar: {
    background: 'var(--surface-alt)',
    borderRight: '1px solid var(--border)',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease',
    flexShrink: 0
  },
  toggle: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    padding: '16px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '1.25rem'
  },
  hamburger: { lineHeight: 1 },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 8px' },
  navItem: {
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  icon: { width: '1.5rem', height: '1.5rem', flexShrink: 0, filter: 'var(--icon-filter, none)' }
};
