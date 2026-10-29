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
export interface ResultRow { player_id: PlayerId; pub_n: number; outcome: 'pass' | 'fail'; set_at: string }
export interface Settings { announcement: string | null; announced_at: string | null; reset_at?: string | null }
export interface BonusRow { id: number; player_id: PlayerId; points: number; reason: string; created_at: string }
export interface PhotoRow { id: string; player_id: PlayerId; pub_n: number | null; path: string; caption: string | null; tagged: PlayerId[]; created_at: string }
export interface JailRow { player_id: PlayerId; last_pub: number | null; since: string; released_at: string | null }

export interface GameState {
  loaded: boolean
  checkins: CheckinRow[]
  results: ResultRow[]
  jail: JailRow[]
  bonuses: BonusRow[]
  photos: PhotoRow[]
  settings: Settings
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
  const [bonuses, setBonuses] = useState<BonusRow[]>([])
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [settings, setSettings] = useState<Settings>({ announcement: null, announced_at: null })
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!supabase) return
    const [c, r, j, s, b, ph] = await Promise.all([
      supabase.from('checkins').select('player_id,pub_n,at,source,by_player'),
      supabase.from('results').select('player_id,pub_n,outcome,set_at'),
      supabase.from('jail').select('player_id,last_pub,since,released_at'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('bonuses').select('id,player_id,points,reason,created_at').order('created_at'),
      supabase.from('photos').select('id,player_id,pub_n,path,caption,tagged,created_at').order('created_at', { ascending: false }),
    ])
    if (c.data) setCheckins(c.data as CheckinRow[])
    if (r.data) setResults(r.data as ResultRow[])
    if (j.data) setJail(j.data as JailRow[])
    if (s.data) setSettings(s.data as Settings)
    if (b.data) setBonuses(b.data as BonusRow[])
    if (ph.data) setPhotos(ph.data as PhotoRow[])
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonuses' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, reload)
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
    // Checking in anywhere after being jailed counts as escaping: no server round trip needed
    const lastAt: Record<string, string> = {}
    for (const c of checkins) if (!lastAt[c.player_id] || c.at > lastAt[c.player_id]) lastAt[c.player_id] = c.at
    const inJail = new Set(
      jail.filter((j) => !j.released_at && !(lastAt[j.player_id] && lastAt[j.player_id] > j.since)).map((j) => j.player_id),
    )
    const resMap = new Map(results.map((r) => [`${r.player_id}:${r.pub_n}`, r.outcome]))
    return {
      loaded, checkins, results, jail, bonuses, photos, settings, lastPub, visited, inJail, reload,
      result: (p: PlayerId, n: number) => resMap.get(`${p}:${n}`),
    }
  }, [loaded, checkins, results, jail, bonuses, photos, settings, reload])
}
