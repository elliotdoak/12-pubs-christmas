import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLAYERS, type PlayerId } from '../data/crawl'

export interface CheckinRow {
  player_id: PlayerId
  pub_n: number
  at: string
  source: 'geo' | 'crew' | 'gm'
  by_player: PlayerId | null
}
export interface ResultRow { player_id: PlayerId; pub_n: number; outcome: 'pass' | 'fail' }
export interface JailRow { player_id: PlayerId; last_pub: number | null; since: string; released_at: string | null }

export interface GameState {
  loaded: boolean
  checkins: CheckinRow[]
  results: ResultRow[]
  jail: JailRow[]
  /** Highest pub each player has reached (0 = not started) */
  lastPub: Record<PlayerId, number>
  visited: Record<PlayerId, Set<number>>
  inJail: Set<PlayerId>
  result: (p: PlayerId, n: number) => 'pass' | 'fail' | undefined
  reload: () => Promise<void>
}

/** Live game state: check-ins, results and Sleepy Jail, kept fresh with Supabase Realtime. */
export function useGame(enabled = true): GameState {
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [jail, setJail] = useState<JailRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [c, r, j] = await Promise.all([
      supabase.from('checkins').select('player_id,pub_n,at,source,by_player'),
      supabase.from('results').select('player_id,pub_n,outcome'),
      supabase.from('jail').select('player_id,last_pub,since,released_at'),
    ])
    if (c.data) setCheckins(c.data as CheckinRow[])
    if (r.data) setResults(r.data as ResultRow[])
    if (j.data) setJail(j.data as JailRow[])
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!supabase || !enabled) return
    const sb = supabase
    reload()
    // Tiny tables: on any change, just refetch everything.
    const ch = sb
      .channel('game')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jail' }, reload)
      .subscribe()
    // Belt and braces: refetch when the app comes back to the foreground, and every minute.
    const vis = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', vis)
    const id = setInterval(reload, 60_000)
    return () => {
      sb.removeChannel(ch)
      document.removeEventListener('visibilitychange', vis)
      clearInterval(id)
    }
  }, [reload, enabled])

  return useMemo(() => {
    const visited = Object.fromEntries(PLAYERS.map((p) => [p.id, new Set<number>()])) as Record<PlayerId, Set<number>>
    for (const c of checkins) visited[c.player_id]?.add(c.pub_n)
    const lastPub = Object.fromEntries(PLAYERS.map((p) => [p.id, Math.max(0, ...visited[p.id])])) as Record<PlayerId, number>
    const inJail = new Set(jail.filter((j) => !j.released_at).map((j) => j.player_id))
    const resMap = new Map(results.map((r) => [`${r.player_id}:${r.pub_n}`, r.outcome]))
    return {
      loaded, checkins, results, jail, lastPub, visited, inJail, reload,
      result: (p: PlayerId, n: number) => resMap.get(`${p}:${n}`),
    }
  }, [loaded, checkins, results, jail, reload])
}
