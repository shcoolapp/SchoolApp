import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/translations';

const TYPE_TARGET = { announcement: 'announcements', homework: 'homework', exam: 'calendar', todo: 'todos', mark: 'marks' };
const TYPE_LABEL = { announcement: 'notifAnnouncement', homework: 'notifHomework', exam: 'notifExam', todo: 'notifTodo', mark: 'notifMark' };

function timeAgo(iso, t) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t('justNow');
  if (mins < 60) return `${mins} ${t('minutesShort')}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${t('hoursShort')}`;
  return `${Math.round(hrs / 24)} ${t('daysShort')}`;
}

export default function NotificationBell({ unread, items, markRead, markAllRead, onNavigate, push }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const t = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  function openItem(n) {
    markRead(n.id);
    setOpen(false);
    onNavigate(TYPE_TARGET[n.type] || 'calendar');
  }

  return (
    <div ref={box} style={styles.wrap}>
      <button style={styles.bell} onClick={() => setOpen(!open)} aria-label={t('notifications')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a6 6 0 0 0-6 6v3.6c0 .6-.2 1.2-.6 1.7L3.8 15.4a1 1 0 0 0 .8 1.6h14.8a1 1 0 0 0 .8-1.6l-1.6-2.1a2.8 2.8 0 0 1-.6-1.7V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 2.8-2H9.2A3 3 0 0 0 12 22z" />
        </svg>
        {unread > 0 && <span style={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div style={styles.menu}>
          <div style={styles.menuHeader}>
            <strong style={{ fontSize: '0.875rem' }}>{t('notifications')}</strong>
            {unread > 0 && <button style={styles.linkBtn} onClick={markAllRead}>{t('markAllRead')}</button>}
          </div>
          {push && push.status === 'default' && (
            <div style={styles.pushBox}>
              <span style={{ fontSize: '0.75rem' }}>{t('pushPrompt')}</span>
              <button style={styles.pushBtn} onClick={push.enable} disabled={push.busy}>{t('pushEnable')}</button>
            </div>
          )}
          {push && push.status === 'denied' && <p style={styles.pushNote}>{t('pushBlocked')}</p>}
          <div style={styles.list}>
            {items.length === 0 && <p style={styles.empty}>{t('noNotifications')}</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                style={{ ...styles.item, background: n.read_at ? 'transparent' : 'var(--cobalt-soft)' }}
              >
                <span style={{ ...styles.dot, background: n.read_at ? 'transparent' : 'var(--cobalt)' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={styles.type}>{t(TYPE_LABEL[n.type])}</span>
                  <span style={styles.title}>{n.title}</span>
                  {n.body && <span style={styles.body}>{n.body}</span>}
                  <span style={styles.time}>{timeAgo(n.created_at, t)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: 'relative' },
  bell: {
    position: 'relative',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  badge: {
    position: 'absolute',
    top: '-6px',
    insetInlineEnd: '-6px',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    background: 'var(--cobalt)',
    color: 'var(--on-cobalt)',
    fontSize: '0.625rem',
    fontWeight: 600,
    lineHeight: '18px',
    textAlign: 'center'
  },
  menu: {
    position: 'absolute',
    top: '44px',
    insetInlineEnd: 0,
    width: 'min(340px, calc(100vw - 32px))',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    zIndex: 50,
    overflow: 'hidden'
  },
  menuHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  linkBtn: { border: 'none', background: 'transparent', color: 'var(--cobalt)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 },
  pushBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', background: 'var(--cobalt-soft)', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  pushBtn: { border: 'none', borderRadius: '6px', background: 'var(--cobalt)', color: 'var(--on-cobalt)', fontSize: '0.75rem', padding: '6px 10px', cursor: 'pointer', flexShrink: 0 },
  pushNote: { margin: 0, padding: '8px 14px', fontSize: '0.688rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' },
  list: { maxHeight: '60vh', overflowY: 'auto' },
  empty: { margin: 0, padding: '18px 14px', fontSize: '0.812rem', color: 'var(--text-secondary)' },
  item: { display: 'flex', gap: '10px', width: '100%', textAlign: 'start', border: 'none', borderBottom: '1px solid var(--border)', padding: '10px 14px', cursor: 'pointer', color: 'var(--text-primary)' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0 },
  type: { display: 'block', fontSize: '0.625rem', fontWeight: 600, color: 'var(--cobalt)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  title: { display: 'block', fontSize: '0.812rem', fontWeight: 500 },
  body: { display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  time: { display: 'block', fontSize: '0.688rem', color: 'var(--text-secondary)', marginTop: '2px' }
};
