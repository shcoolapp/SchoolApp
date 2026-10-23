import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Calendar from '../components/Calendar';
import SubjectsPanel from '../components/SubjectsPanel';
import SettingsPanel from '../components/SettingsPanel';
import HomeworkPanel from '../components/HomeworkPanel';
import AccountPanel from '../components/AccountPanel';
import MarksPanel from '../components/MarksPanel';
import NoticesPanel from '../components/NoticesPanel';
import InstallPrompt from '../components/InstallPrompt';
import useNotifications from '../hooks/useNotifications';
import usePush from '../hooks/usePush';
import { unsubscribeFromPush } from '../lib/push';
import { clearToken, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function Dashboard() {
  const [active, setActive] = useState('calendar');
  const navigate = useNavigate();
  const user = getStoredUser();
  const t = useTranslation();
  const notifications = useNotifications();
  const push = usePush();

  // announcements and activities are shown on the Notices page itself, so opening it counts as reading them
  useEffect(() => {
    if (active !== 'notices') return;
    notifications.items
      .filter((n) => (n.type === 'announcement' || n.type === 'todo') && !n.read_at)
      .forEach((n) => notifications.markRead(n.id));
  }, [active, notifications.items]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await unsubscribeFromPush(); // needs the token, so before clearToken()
    clearToken();
    navigate('/');
  }

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar active={active} onSelect={setActive} noticesBadge={notifications.unread} />
      <main className="app-main" style={{ flex: 1, padding: '2rem', minWidth: 0 }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {t('signedInAs')} {user?.name} ({user?.role})
          </p>
          <button onClick={handleLogout} style={styles.logoutBtn}>{t('signOut')}</button>
        </div>

        <InstallPrompt />

        {active === 'calendar' && <Calendar />}
        {active === 'notices' && <NoticesPanel notifications={notifications} push={push} onNavigate={setActive} />}
        {active === 'homework' && <HomeworkPanel />}
        {active === 'marks' && <MarksPanel />}
        {active === 'subjects' && <SubjectsPanel />}
        {active === 'settings' && <SettingsPanel />}
        {active === 'account' && <AccountPanel />}
      </main>
    </div>
  );
}

const styles = {
  logoutBtn: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '0.812rem',
    cursor: 'pointer'
  }
};
