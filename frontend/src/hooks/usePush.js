import { useCallback, useEffect, useState } from 'react';
import { pushSupported, subscribeToPush } from '../lib/push';

// 'unsupported' | 'default' | 'granted' | 'denied'
export default function usePush() {
  const [status, setStatus] = useState(() => (pushSupported() ? Notification.permission : 'unsupported'));
  const [busy, setBusy] = useState(false);

  // Already allowed on this device: make sure it is attached to whoever is signed in now.
  useEffect(() => {
    if (status === 'granted') subscribeToPush().catch(() => {});
  }, [status]);

  const enable = useCallback(async () => {
    if (!pushSupported()) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setStatus(result);
      if (result === 'granted') await subscribeToPush();
    } catch {
      /* push switched off on the server, or the browser refused */
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable };
}
