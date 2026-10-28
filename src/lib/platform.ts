export type OS = 'ios' | 'android' | 'other'

export function detectOS(): OS {
  const ua = navigator.userAgent
  // iPadOS reports as Mac, so also check for touch
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** True when opened from the home screen icon rather than a browser tab. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

// Android Chrome fires this when the app can be installed; we hold on to it for our own Install button.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  listeners.forEach((l) => l())
})

export function canPromptInstall() {
  return deferred !== null
}

export function onInstallAvailable(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  return outcome === 'accepted'
}

export type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported'

export function notificationState(): PermState {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

export async function requestNotifications(): Promise<PermState> {
  if (!('Notification' in window)) return 'unsupported'
  const r = await Notification.requestPermission()
  return r === 'default' ? 'prompt' : r
}

export function requestLocation(): Promise<PermState> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve('unsupported')
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'granted'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

export async function locationState(): Promise<PermState> {
  if (!('geolocation' in navigator)) return 'unsupported'
  try {
    const s = await navigator.permissions.query({ name: 'geolocation' })
    return s.state
  } catch {
    return 'prompt' // Safari before 16 has no permissions API for geolocation
  }
}
