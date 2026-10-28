import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { PlayerId } from '../data/crawl'

interface SessionState {
  ready: boolean
  error: string | null
  session: Session | null
  playerId: PlayerId | null
  isGm: boolean
  /** Re-read claims after claim_player / claim_gm / release_* */
  refresh: () => Promise<void>
}

const Ctx = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local')
      setReady(true)
      return
    }
    const sb = supabase
    let cancelled = false

    ;(async () => {
      const { data } = await sb.auth.getSession()
      let s = data.session
      if (!s) {
        // Every phone gets an anonymous session; the player claim is added on top later.
        const res = await sb.auth.signInAnonymously()
        if (res.error) {
          if (!cancelled) setError('Could not connect to the game. Check your signal and reopen the app.')
        }
        s = res.data.session
      }
      if (!cancelled) {
        setSession(s)
        setReady(true)
      }
    })()

    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.refreshSession()
    setSession(data.session)
  }, [])

  const meta = (session?.user.app_metadata ?? {}) as { player_id?: PlayerId; role?: string }

  return (
    <Ctx.Provider value={{ ready, error, session, playerId: meta.player_id ?? null, isGm: meta.role === 'gm', refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used inside SessionProvider')
  return v
}
