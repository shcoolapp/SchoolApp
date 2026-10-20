import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Calendar from '../components/Calendar';
import TodoList from '../components/TodoList';
import SubjectsPanel from '../components/SubjectsPanel';
import SettingsPanel from '../components/SettingsPanel';
import HomeworkPanel from '../components/HomeworkPanel';
import AccountPanel from '../components/AccountPanel';
import MarksPanel from '../components/MarksPanel';
import { clearToken, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function Dashboard() {
  const [active, setActive] = useState('calendar');
  const navigate = useNavigate();
  const user = getStoredUser();
  const t = useTranslation();

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar active={active} onSelect={setActive} />
      <main style={{ flex: 1, padding: '2rem', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {t('signedInAs')} {user?.name} ({user?.role})
          </p>
          <button onClick={handleLogout} style={styles.logoutBtn}>{t('signOut')}</button>
        </div>

        {active === 'calendar' && <Calendar />}
        {active === 'todos' && <TodoList />}
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
