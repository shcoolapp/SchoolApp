import { useState } from 'react';
import { api, getStoredUser, setStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function AccountPanel() {
  const t = useTranslation();
  const [user, setUser] = useState(getStoredUser());
  const [form, setForm] = useState({ name: user?.name || '', username: user?.username || '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && !currentPassword) {
      setError(t('currentPasswordRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = { name: form.name, username: form.username };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const updated = await api.updateMe(payload);
      const merged = { ...user, ...updated };
      setUser(merged);
      setStoredUser(merged);
      setCurrentPassword('');
      setNewPassword('');
      setSuccess(t('accountUpdated'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '420px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        {t('account')}
      </h2>

      <div style={styles.row}>
        <p style={styles.label}>{t('role')}</p>
        <p style={styles.value}>{user?.role === 'teacher' ? t('teacher') : user?.role === 'admin' ? t('admin') : t('student')}</p>
      </div>

      <form onSubmit={handleSave} style={{ marginTop: '1rem' }}>
        <label style={styles.fieldLabel}>{t('name')}</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={styles.input}
        />

        <label style={styles.fieldLabel}>{t('username')}</label>
        <input
          type="text"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          style={styles.input}
        />

        <hr style={{ margin: '1.25rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

        <p style={{ fontSize: '0.812rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{t('changePasswordOptional')}</p>

        <label style={styles.fieldLabel}>{t('currentPassword')}</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={styles.input}
        />

        <label style={styles.fieldLabel}>{t('newPassword')}</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={styles.input}
        />

        {error && <p style={{ color: '#c0392b', fontSize: '0.812rem', marginTop: '8px' }}>{error}</p>}
        {success && <p style={{ color: '#2e7d32', fontSize: '0.812rem', marginTop: '8px' }}>{success}</p>}

        <button type="submit" style={styles.primaryBtn} disabled={saving}>
          {saving ? t('saving') : t('saveChanges')}
        </button>
      </form>
    </div>
  );
}

const styles = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)' },
  label: { margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' },
  value: { margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 },
  fieldLabel: { display: 'block', fontSize: '0.812rem', fontWeight: 500, marginTop: '10px', marginBottom: '4px', color: 'var(--text-primary)' },
  input: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.812rem',
    width: '100%',
    boxSizing: 'border-box'
  },
  primaryBtn: {
    marginTop: '1.25rem',
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontSize: '0.812rem',
    cursor: 'pointer'
  }
};
