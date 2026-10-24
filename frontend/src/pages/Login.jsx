import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';
import DoorScene from '../components/doorScene/DoorScene';
import { paletteVars } from '../components/doorScene/doorConfig';
import '../components/doorScene/doorLogin.css';

// A login QR code opens the portal as  https://portal/#u=<username>&p=<password>.
// The part after # never reaches the server. Read it once to pre-fill the form.
function credentialsFromLink() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return { username: params.get('u') || '', password: params.get('p') || '' };
}

export default function Login() {
  const [username, setUsername] = useState(() => credentialsFromLink().username);
  const [password, setPassword] = useState(() => credentialsFromLink().password);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const t = useTranslation();
  const door = useRef(null);

  // Remove the credentials from the address bar (and history) right after they are read.
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Enter both username and password');
      return;
    }
    setLoading(true);
    door.current?.play(); // the door opens and keeps looping while we wait for the server
    try {
      const { token, user } = await api.login(username, password);
      setToken(token);
      setStoredUser(user);
      door.current.success(() => navigate('/dashboard')); // fade to white, then enter the portal
    } catch (err) {
      setError(err.message);
      door.current?.fail(); // the door shuts again
      setLoading(false);
    }
  }

  return (
    <div className="door-login" style={paletteVars}>
      <div className="door-login__scene">
        <DoorScene ref={door} />
      </div>

      <form className="door-login__panel" onSubmit={handleSubmit}>
        <h1>{t('appName')}</h1>
        <p className="door-login__sub">{t('signInToContinue')}</p>

        <div>
          <label htmlFor="login-username">{t('username')}</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="login-password">{t('password')}</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="door-login__error" role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? t('signingIn') : t('signIn')}
        </button>
      </form>
    </div>
  );
}
