/**
 * Client-side Web Push helpers: subscribe/unsubscribe the browser and sync the
 * subscription with the server. Pairs with the `push`/`notificationclick`
 * handlers in public/sw.js and the /api/push/* routes.
 *
 * All functions are browser-only and fail soft (return false) when push isn't
 * supported (e.g. iOS Safari that isn't an installed PWA, or no VAPID key).
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** True when this browser can do Web Push at all. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID public key → Uint8Array (applicationServerKey wants raw bytes). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Back with a concrete ArrayBuffer so the result is a valid BufferSource
  // (a plain `new Uint8Array(n)` is ArrayBufferLike and TS rejects it here).
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Ensure the service worker is registered and ready, returning its registration. */
async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready.then(() => reg as ServiceWorkerRegistration);
}

/**
 * Subscribe this browser to push and persist it server-side. Assumes
 * Notification permission is already "granted" (call after requestPermission).
 * Returns true on success.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return false;
  try {
    const reg = await getReadyRegistration();
    const existing = await reg.pushManager.getSubscription();
    const subscription =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const json = subscription.toJSON();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        timezone,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to subscribe to push:", error);
    return false;
  }
}

/** Unsubscribe this browser and remove it server-side. Returns true on success. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const subscription = await reg?.pushManager.getSubscription();
    if (!subscription) return true; // already gone

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);

    await subscription.unsubscribe();
    return true;
  } catch (error) {
    console.error("Failed to unsubscribe from push:", error);
    return false;
  }
}
