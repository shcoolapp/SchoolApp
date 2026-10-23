import { useState } from 'react';
import { useTranslation } from '../i18n/translations';
import { getStoredUser } from '../api/client';

export default function Sidebar({ active, onSelect, noticesBadge = 0 }) {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700); // start collapsed on phones
  const t = useTranslation();
  const user = getStoredUser();

  const NAV_ITEMS = [
    { key: 'notices', label: t('announcementsAndTodo'), icon: '/icons/bell.png', badge: noticesBadge },
    { key: 'calendar', label: t('calendar'), icon: '/icons/calendar.png' },
    { key: 'homework', label: t('homework'), icon: '/icons/homework.png' },
    { key: 'marks', label: t('marks'), icon: '/icons/subjects.png' },
    // Subjects management is admin-only — hidden from regular teachers/students
    // to keep the app simpler for the people actually teaching/studying.
    ...(user?.role === 'admin' ? [{ key: 'subjects', label: t('subjects'), icon: '/icons/subjects.png' }] : []),
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
            <span
              aria-hidden="true"
              style={{
                ...styles.icon,
                WebkitMaskImage: `url(${item.icon})`,
                maskImage: `url(${item.icon})`,
                ...(item.iconSize ? { width: item.iconSize, height: item.iconSize } : {})
              }}
            />
            {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
            {item.badge > 0 && (
              <span style={collapsed ? styles.badgeCollapsed : styles.badge}>{item.badge > 99 ? '99+' : item.badge}</span>
            )}
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
    gap: '10px',
    position: 'relative'
  },
  badge: {
    minWidth: '18px', height: '18px', padding: '0 5px', boxSizing: 'border-box', borderRadius: '9px',
    background: 'var(--cobalt)', color: 'var(--on-cobalt)', fontSize: '0.625rem', fontWeight: 600, lineHeight: '18px', textAlign: 'center'
  },
  badgeCollapsed: {
    position: 'absolute', top: '4px', insetInlineEnd: '4px', minWidth: '16px', height: '16px', padding: '0 4px', boxSizing: 'border-box',
    borderRadius: '8px', background: 'var(--cobalt)', color: 'var(--on-cobalt)', fontSize: '0.562rem', fontWeight: 600, lineHeight: '16px', textAlign: 'center'
  },
  icon: {
    width: '1.5rem',
    height: '1.5rem',
    flexShrink: 0,
    display: 'inline-block',
    background: 'var(--text-primary)', // navy in light theme, light in dark theme
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain'
  }
};
