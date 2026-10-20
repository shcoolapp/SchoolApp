import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const t = useTranslation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Enter both username and password');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await api.login(username, password);
      setToken(token);
      setStoredUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <img src="/icons/login.png" alt="" style={styles.icon} />
        <h1 style={styles.title}>{t('appName')}</h1>
        <p style={styles.subtitle}>{t('signInToContinue')}</p>

        <label style={styles.label}>{t('username')}</label>
        <input
          style={styles.input}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label style={styles.label}>{t('password')}</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? t('signingIn') : t('signIn')}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)'
  },
  card: {
    background: 'var(--surface)',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    width: '360px',
    display: 'flex',
    flexDirection: 'column'
  },
  title: { fontSize: '1.375rem', fontWeight: 500, margin: '0 0 4px', color: 'var(--text-primary)' },
  icon: { width: '3.5rem', height: '3.5rem', margin: '0 auto 16px', filter: 'var(--icon-filter, none)' },
  subtitle: { fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 24px' },
  label: { fontSize: '0.812rem', fontWeight: 500, marginBottom: '6px', marginTop: '12px', color: 'var(--text-primary)' },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem'
  },
  button: {
    marginTop: '24px',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer'
  },
  error: { color: '#c0392b', fontSize: '0.812rem', marginTop: '12px' }
};
