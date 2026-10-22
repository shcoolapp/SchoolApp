import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

const POLL_MS = 60 * 1000;

// Loads the signed-in user's notifications and refreshes them every minute
// (and whenever the tab becomes visible again).
export default function useNotifications() {
  const [data, setData] = useState({ unread: 0, items: [] });

  const refresh = useCallback(async () => {
    try {
      setData(await api.getNotifications());
    } catch {
      /* keep the last known list; notifications are best-effort */
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const markRead = useCallback(async (id) => {
    setData((d) => {
      const target = d.items.find((n) => n.id === id);
      if (!target || target.read_at) return d;
      return { unread: Math.max(0, d.unread - 1), items: d.items.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)) };
    });
    try { await api.markNotificationRead(id); } catch { refresh(); }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setData((d) => ({ unread: 0, items: d.items.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })) }));
    try { await api.markAllNotificationsRead(); } catch { refresh(); }
  }, [refresh]);

  return { ...data, refresh, markRead, markAllRead };
}
