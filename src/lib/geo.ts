import { PUBS, gameNow, gateTime, isGameDay, type Pub } from '../data/crawl'

/** Distance in metres between two points (haversine). */
export function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface Fix {
  lat: number
  lng: number
  accuracy: number
  at: number
}

export interface CheckinDecision {
  pub: Pub | null
  /** Nearest unvisited pub and how far away it is, for the status chip. */
  nearest: { pub: Pub; m: number } | null
  /** Why we didn't check in, if we didn't. */
  reason?: 'too_far' | 'too_early' | 'poor_signal' | 'done'
}

const MAX_ACCURACY_CREDIT = 40 // metres of GPS wobble we'll forgive
const UNUSABLE_ACCURACY = 150 // worse than this, ignore the fix

/**
 * Decide whether this location fix should check the player in.
 * Rules:
 *  - only pubs you haven't checked in to yet, and only ahead of your last pub (skipping ahead is fine)
 *  - it must be the nearest such pub, and within its radius (with some GPS wobble forgiven)
 *  - on game day, not before the pub's gate time (stops next-door pubs firing early)
 *  - in practice mode the phone runs a game clock from 28 Nov 12.30pm, so the same gates apply
 */
export function decide(fix: Fix, visited: Set<number>, now = gameNow()): CheckinDecision {
  const last = Math.max(0, ...visited)
  const candidates = PUBS.filter((p) => p.n > last && !visited.has(p.n))
  if (!candidates.length) return { pub: null, nearest: null, reason: 'done' }

  const ranked = candidates
    .map((p) => ({ pub: p, m: metres(fix.lat, fix.lng, p.lat, p.lng) }))
    .sort((a, b) => a.m - b.m)
  const nearest = ranked[0]

  if (fix.accuracy > UNUSABLE_ACCURACY) return { pub: null, nearest, reason: 'poor_signal' }
  const effective = nearest.m - Math.min(fix.accuracy, MAX_ACCURACY_CREDIT)
  if (effective > nearest.pub.radius) return { pub: null, nearest, reason: 'too_far' }
  if (isGameDay(now) && now < gateTime(nearest.pub.n)) return { pub: null, nearest, reason: 'too_early' }
  return { pub: nearest.pub, nearest }
}

export function fmtDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`
}
