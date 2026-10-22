import { api } from '../api/client';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Subscribes this device and tells the server about it. Returns true when push is on.
export async function subscribeToPush() {
  if (!pushSupported()) return false;
  const { publicKey } = await api.getPushPublicKey(); // throws if the server has push switched off
  const registration = await navigator.serviceWorker.ready;
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }
  await api.pushSubscribe(sub.toJSON());
  return true;
}

// Called on sign-out so the next person using this device doesn't receive the previous user's alerts.
export async function unsubscribeFromPush() {
  try {
    if (!pushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return;
    await api.pushUnsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* best effort */
  }
}
