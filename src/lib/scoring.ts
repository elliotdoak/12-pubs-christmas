import { PLAYERS, SCORING, pubByN, type PlayerId } from '../data/crawl'
import type { GameState } from '../hooks/useGame'

export interface ScoreItem {
  label: string
  points: number
}

export interface Score {
  id: PlayerId
  pts: number
  rank: number
  pubs: number
  passed: number
  failed: number
  jailed: boolean
  items: ScoreItem[]
}

/**
 * Points, all derived from live data so they can't drift:
 *   +10 each pub reached, +15 challenge passed, -15 challenge failed,
 *   -40 if ever sent to Sleepy Jail,
 *   plus any Game Master bonuses (best dressed at Press Bar +25, worst dressed -25).
 *   +5 for posting a photo at a pub (once per pub, plus once before the crawl).
 */
export function computeScores(game: GameState): Score[] {
  // Photo points count once per pub, so spamming the wall doesn't win the night
  const photoPubs: Partial<Record<PlayerId, Set<number>>> = {}
  for (const ph of game.photos) (photoPubs[ph.player_id] ??= new Set()).add(ph.pub_n ?? 0)

  const scores = PLAYERS.map((p): Score => {
    const items: ScoreItem[] = []
    const pubs = game.visited[p.id].size
    if (pubs) items.push({ label: `${pubs} pub${pubs === 1 ? '' : 's'} reached`, points: pubs * SCORING.reachPub })

    // Pubs with no pass / fail (or best / worst dressed instead) never score a verdict, even a stale one
    const mine = game.results.filter((r) => r.player_id === p.id && !pubByN(r.pub_n).judging)
    const passed = mine.filter((r) => r.outcome === 'pass').length
    const failed = mine.length - passed
    if (passed) items.push({ label: `${passed} challenge${passed === 1 ? '' : 's'} passed`, points: passed * SCORING.challengePassed })
    if (failed) items.push({ label: `${failed} challenge${failed === 1 ? '' : 's'} failed`, points: failed * SCORING.challengeFailed })

    const jailed = game.jail.some((j) => j.player_id === p.id)
    if (jailed) items.push({ label: 'Sent to Sleepy Jail', points: SCORING.sleepyJail })

    for (const b of game.bonuses.filter((b) => b.player_id === p.id)) items.push({ label: b.reason, points: b.points })

    const snaps = photoPubs[p.id]?.size ?? 0
    if (snaps) items.push({ label: `Photos posted at ${snaps} stop${snaps === 1 ? '' : 's'}`, points: snaps * SCORING.photo })

    return {
      id: p.id, pts: items.reduce((s, i) => s + i.points, 0), rank: 0,
      pubs, passed, failed, jailed: game.inJail.has(p.id), items,
    }
  })

  // Highest first; ties broken by pubs reached, then name. Equal points share a rank.
  scores.sort((a, b) => b.pts - a.pts || b.pubs - a.pubs || name(a.id).localeCompare(name(b.id)))
  scores.forEach((s, i) => (s.rank = i > 0 && scores[i - 1].pts === s.pts ? scores[i - 1].rank : i + 1))
  return scores
}

const name = (id: PlayerId) => PLAYERS.find((p) => p.id === id)!.name

export const ordinal = (n: number) => `${n}${n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH'}`
