import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSession } from './session'
import { useGame, type GameState } from '../hooks/useGame'
import { decide, type CheckinDecision, type Fix } from './geo'
import { load, save } from './storage'
import { isGameDay, type Pub, type PlayerId } from '../data/crawl'

export type GeoStatus = 'off' | 'waiting' | 'tracking' | 'denied' | 'unsupported'

interface GameCtx {
  game: GameState
  geo: { status: GeoStatus; fix: Fix | null; decision: CheckinDecision | null }
  /** Auto check-in runs on game day, or on this phone when practice mode is on. */
  active: boolean
  practice: boolean
  setPractice: (on: boolean) => void
  /** Set right after this phone checks you in; drives the "who's with you?" prompt. */
  justCheckedIn: Pub | null
  dismissCheckin: () => void
  checkInCrew: (pub: number, ids: PlayerId[]) => Promise<boolean>
}

const Ctx = createContext<GameCtx | null>(null)
const LOCATION_EVERY_MS = 30_000

export function GameProvider({ children }: { children: ReactNode }) {
  const { playerId, session } = useSession()
  const game = useGame(!!session)
  const [practice, setPracticeState] = useState(() => load('practice', false))
  const [status, setStatus] = useState<GeoStatus>('off')
  const [fix, setFix] = useState<Fix | null>(null)
  const [decision, setDecision] = useState<CheckinDecision | null>(null)
  const [justCheckedIn, setJust] = useState<Pub | null>(null)
  const lastSent = useRef(0)
  const inFlight = useRef(new Set<number>())
  const checkedHere = useRef(new Set<number>())
  const lastFix = useRef<Fix | null>(null)

  const active = !!playerId && (isGameDay() || practice)

  const setPractice = (on: boolean) => {
    save('practice', on)
    setPracticeState(on)
  }

  // Keep the latest visited set in a ref so the GPS callback never sees stale data.
  const visitedRef = useRef<Set<number>>(new Set())
  const reloadRef = useRef(game.reload)
  const loadedRef = useRef(false)
  useEffect(() => {
    loadedRef.current = game.loaded
    const server = playerId ? game.visited[playerId] ?? new Set<number>() : new Set<number>()
    // checkedHere only lives until the app is closed, so a GM undo or wipe sticks after a reopen
    visitedRef.current = new Set([...server, ...checkedHere.current])
    reloadRef.current = game.reload
  })

  const onFix = useCallback(
    async (f: Fix) => {
      if (!supabase || !playerId) return
      lastFix.current = f
      setFix(f)
      setStatus('tracking')
      const d = decide(f, visitedRef.current)
      setDecision(d)

      // Share position with the crew (throttled)
      if (f.at - lastSent.current > LOCATION_EVERY_MS) {
        lastSent.current = f.at
        supabase.from('locations').upsert({
          player_id: playerId, lat: f.lat, lng: f.lng, accuracy_m: f.accuracy, updated_at: new Date(f.at).toISOString(),
        }).then(() => {})
      }

      // Wait for the check-in list first, or a fresh app open could re-check you in to old pubs
      if (loadedRef.current && d.pub && !inFlight.current.has(d.pub.n) && !visitedRef.current.has(d.pub.n)) {
        const pub = d.pub
        inFlight.current.add(pub.n)
        const { error } = await supabase.from('checkins').upsert(
          { player_id: playerId, pub_n: pub.n, source: 'geo', by_player: playerId, accuracy_m: f.accuracy },
          { onConflict: 'player_id,pub_n', ignoreDuplicates: true },
        )
        if (!error) {
          // Count it straight away so the next GPS fix doesn't check in again before the reload lands
          checkedHere.current.add(pub.n)
          navigator.vibrate?.([80, 40, 80])
          setJust(pub)
          reloadRef.current()
        }
        inFlight.current.delete(pub.n)
      }
    },
    [playerId],
  )

  // A phone standing still may not send new fixes, so re-check the last one once the data arrives.
  useEffect(() => {
    if (game.loaded && lastFix.current) onFix(lastFix.current)
  }, [game.loaded, onFix])

  // Watch position while the app is open and visible.
  useEffect(() => {
    if (!active) {
      setStatus('off')
      return
    }
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    let watch: number | null = null
    const start = () => {
      if (watch !== null) return
      setStatus((s) => (s === 'tracking' ? s : 'waiting'))
      watch = navigator.geolocation.watchPosition(
        (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp }),
        (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'waiting'),
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
      )
    }
    const stop = () => {
      if (watch !== null) navigator.geolocation.clearWatch(watch)
      watch = null
    }
    const vis = () => (document.visibilityState === 'visible' ? start() : stop())
    vis()
    document.addEventListener('visibilitychange', vis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [active, onFix])

  const checkInCrew = useCallback(
    async (pub: number, ids: PlayerId[]) => {
      if (!supabase || !playerId || !ids.length) return true
      const { error } = await supabase.from('checkins').upsert(
        ids.map((id) => ({ player_id: id, pub_n: pub, source: 'crew', by_player: playerId })),
        { onConflict: 'player_id,pub_n', ignoreDuplicates: true },
      )
      reloadRef.current()
      return !error
    },
    [playerId],
  )

  return (
    <Ctx.Provider
      value={{
        game, geo: { status, fix, decision }, active, practice, setPractice,
        justCheckedIn, dismissCheckin: () => setJust(null), checkInCrew,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useGameCtx() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGameCtx must be used inside GameProvider')
  return v
}
