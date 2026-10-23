import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/translations';

const DISMISS_KEY = 'installPromptDismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Suggests adding the portal to the Home Screen. Hidden once installed or dismissed.
export default function InstallPrompt() {
  const t = useTranslation();
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || isStandalone()) return null;
  const ios = isIos();
  if (!deferred && !ios) return null; // other browsers: nothing reliable to offer

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    dismiss();
  }

  return (
    <div style={styles.box}>
      <img src="/icons/icon-192.png" alt="" style={styles.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: '0.812rem' }}>{t('installTitle')}</strong>
        <p style={styles.text}>{deferred ? t('installAndroid') : t('installIos')}</p>
      </div>
      {deferred && <button style={styles.btn} onClick={install}>{t('installButton')}</button>}
      <button style={styles.close} onClick={dismiss} aria-label={t('close')}>&times;</button>
    </div>
  );
}

const styles = {
  box: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', marginBottom: '1rem',
    background: 'var(--cobalt-soft)', border: '1px solid var(--border)', borderInlineStart: '4px solid var(--cobalt)',
    borderRadius: '10px', color: 'var(--text-primary)'
  },
  icon: { width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0 },
  text: { margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' },
  btn: { border: 'none', borderRadius: '8px', background: 'var(--cobalt)', color: 'var(--on-cobalt)', fontSize: '0.75rem', padding: '7px 12px', cursor: 'pointer', flexShrink: 0 },
  close: { border: 'none', background: 'transparent', fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }
};
