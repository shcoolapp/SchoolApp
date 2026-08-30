import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n/translations';

export default function SettingsPanel() {
  const { settings, updateSetting } = useSettings();
  const t = useTranslation();

  return (
    <div style={{ maxWidth: '420px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1.5rem' }}>{t('settings')}</h2>

      <div style={styles.row}>
        <p style={styles.label}>{t('theme')}</p>
        <div style={styles.toggleGroup}>
          <button
            onClick={() => updateSetting('theme', 'light')}
            style={{ ...styles.toggleBtn, ...(settings.theme === 'light' ? styles.toggleBtnActive : {}) }}
          >
            {t('light')}
          </button>
          <button
            onClick={() => updateSetting('theme', 'dark')}
            style={{ ...styles.toggleBtn, ...(settings.theme === 'dark' ? styles.toggleBtnActive : {}) }}
          >
            {t('dark')}
          </button>
        </div>
      </div>

      <div style={styles.row}>
        <p style={styles.label}>{t('language')}</p>
        <div style={styles.toggleGroup}>
          <button
            onClick={() => updateSetting('language', 'en')}
            style={{ ...styles.toggleBtn, ...(settings.language === 'en' ? styles.toggleBtnActive : {}) }}
          >
            EN
          </button>
          <button
            onClick={() => updateSetting('language', 'ar')}
            style={{ ...styles.toggleBtn, ...(settings.language === 'ar' ? styles.toggleBtnActive : {}) }}
          >
            AR
          </button>
        </div>
      </div>

      <div style={styles.row}>
        <p style={styles.label}>{t('fontSize')}</p>
        <div style={styles.toggleGroup}>
          {['small', 'medium', 'large'].map((size) => (
            <button
              key={size}
              onClick={() => updateSetting('fontSize', size)}
              style={{ ...styles.toggleBtn, ...(settings.fontSize === size ? styles.toggleBtnActive : {}) }}
            >
              {t(size)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)' },
  label: { margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' },
  toggleGroup: { display: 'flex', gap: '6px' },
  toggleBtn: {
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.812rem',
    cursor: 'pointer'
  },
  toggleBtnActive: {
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    borderColor: 'var(--accent)'
  }
};
