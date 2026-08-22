import { getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function AccountPanel() {
  const user = getStoredUser();
  const t = useTranslation();

  return (
    <div style={{ maxWidth: '420px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        {t('account')}
      </h2>

      <div style={styles.row}>
        <p style={styles.label}>{t('name')}</p>
        <p style={styles.value}>{user?.name}</p>
      </div>
      <div style={styles.row}>
        <p style={styles.label}>{t('role')}</p>
        <p style={styles.value}>{user?.role === 'teacher' ? t('teacher') : t('student')}</p>
      </div>
    </div>
  );
}

const styles = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)' },
  label: { margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' },
  value: { margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }
};
