import { supabase } from './supabase'

/**
 * Web push sign-up. Once alerts are allowed and a player is picked, the phone subscribes and saves
 * the subscription against that player. It re-saves on every open, since phones rotate them.
 * iPhones only support this in the home-screen app (iOS 16.4+), never in a Safari tab.
 */

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function pushSupported() {
  return !!KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// The service worker only exists in a production build, so don't wait forever for it in dev
async function registration() {
  if (!pushSupported()) return null
  return (await navigator.serviceWorker.getRegistration()) ? navigator.serviceWorker.ready : null
}

/** Subscribe (if needed) and save against the current player. Quietly does nothing when it can't. */
export async function syncPush(): Promise<boolean> {
  if (!supabase || !pushSupported() || Notification.permission !== 'granted') return false
  try {
    const reg = await registration()
    if (!reg) return false
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY!) }))
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys) return false
    const { data, error } = await supabase.rpc('save_push', {
      p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent,
    })
    return !error && (data as { ok: boolean } | null)?.ok === true
  } catch {
    return false
  }
}

/** Stop the current player getting this phone's alerts, before switching player. */
export async function dropPush() {
  if (!supabase) return
  try {
    const sub = await (await registration())?.pushManager.getSubscription()
    if (sub) await supabase.rpc('drop_push', { p_endpoint: sub.endpoint })
  } catch {
    // Nothing to tidy up
  }
}

export interface NotifyResult { ok: boolean; sent?: number; failed?: number; players?: number; error?: string }

/** Game Master: push the alarm or the current announcement to everyone, or the Sleepy Jail alert to one player. */
export async function notify(kind: 'alarm' | 'announce' | 'jail', player?: string): Promise<NotifyResult> {
  if (!supabase) return { ok: false, error: 'offline' }
  const { data, error } = await supabase.functions.invoke('notify', { body: { kind, player } })
  if (error) return { ok: false, error: error.message }
  return data as NotifyResult
}

function toBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
