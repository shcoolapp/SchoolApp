import { useState } from 'react';
import AnnouncementsPanel from './AnnouncementsPanel';
import TodoList from './TodoList';
import { useTranslation } from '../i18n/translations';

const TYPE_TARGET = { homework: 'homework', exam: 'calendar', mark: 'marks' }; // announcements and activities are on this page
const TYPE_LABEL = { announcement: 'notifAnnouncement', homework: 'notifHomework', exam: 'notifExam', todo: 'notifTodo', mark: 'notifMark' };
const VISIBLE = 6;

function timeAgo(iso, t) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t('justNow');
  if (mins < 60) return `${mins} ${t('minutesShort')}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${t('hoursShort')}`;
  return `${Math.round(hrs / 24)} ${t('daysShort')}`;
}

// One page for everything the school says to you: alerts, announcements and the to-do list.
export default function NoticesPanel({ notifications, push, onNavigate }) {
  const t = useTranslation();
  const { unread, items, markRead, markAllRead, refresh } = notifications;
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, VISIBLE);

  function openItem(n) {
    markRead(n.id);
    const target = TYPE_TARGET[n.type];
    if (target) onNavigate(target);
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <section style={styles.section}>
        <div style={styles.head}>
          <h2 style={styles.h2}>{t('notifications')}</h2>
          {unread > 0 && <button style={styles.linkBtn} onClick={markAllRead}>{t('markAllRead')}</button>}
        </div>

        {push && push.status === 'default' && (
          <div style={styles.pushBox}>
            <span style={{ fontSize: '0.75rem' }}>{t('pushPrompt')}</span>
            <button style={styles.pushBtn} onClick={push.enable} disabled={push.busy}>{t('pushEnable')}</button>
          </div>
        )}
        {push && push.status === 'denied' && <p style={styles.note}>{t('pushBlocked')}</p>}

        {items.length === 0 && <p style={styles.note}>{t('noNotifications')}</p>}
        {shown.map((n) => (
          <button
            key={n.id}
            onClick={() => openItem(n)}
            style={{ ...styles.item, background: n.read_at ? 'var(--surface)' : 'var(--cobalt-soft)' }}
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
        {items.length > VISIBLE && (
          <button style={styles.linkBtn} onClick={() => setShowAll(!showAll)}>
            {showAll ? t('showLess') : t('showAll')}
          </button>
        )}
      </section>

      <section style={styles.section}>
        <AnnouncementsPanel onChanged={refresh} />
      </section>

      <section style={styles.section}>
        <TodoList />
      </section>
    </div>
  );
}

const styles = {
  section: { marginBottom: '2rem' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '0.75rem' },
  h2: { margin: 0, fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)' },
  linkBtn: { border: 'none', background: 'transparent', color: 'var(--cobalt)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 },
  note: { margin: '0 0 8px', fontSize: '0.812rem', color: 'var(--text-secondary)' },
  pushBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', marginBottom: '8px', background: 'var(--cobalt-soft)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)' },
  pushBtn: { border: 'none', borderRadius: '6px', background: 'var(--cobalt)', color: 'var(--on-cobalt)', fontSize: '0.75rem', padding: '6px 10px', cursor: 'pointer', flexShrink: 0 },
  item: { display: 'flex', gap: '10px', width: '100%', textAlign: 'start', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', marginBottom: '6px', cursor: 'pointer', color: 'var(--text-primary)' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0 },
  type: { display: 'block', fontSize: '0.625rem', fontWeight: 600, color: 'var(--cobalt)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  title: { display: 'block', fontSize: '0.812rem', fontWeight: 500 },
  body: { display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' },
  time: { display: 'block', fontSize: '0.688rem', color: 'var(--text-secondary)', marginTop: '2px' }
};
