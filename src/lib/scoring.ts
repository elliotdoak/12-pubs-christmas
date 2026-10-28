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
  firstIn: number
  jailed: boolean
  items: ScoreItem[]
}

/**
 * Points, all derived from live data so they can't drift:
 *   +10 each pub reached, +15 challenge passed, -5 challenge failed,
 *   +5 first through the door at a pub, -10 if ever sent to Sleepy Jail,
 *   plus any Game Master bonuses (best dressed at Press Bar is +20).
 * Photos (+2 each) join in when the photo wall lands.
 */
export function computeScores(game: GameState, photos: Partial<Record<PlayerId, number>> = {}): Score[] {
  // Who was first through the door at each pub
  const first = new Map<number, { id: PlayerId; at: string }>()
  for (const c of game.checkins) {
    const f = first.get(c.pub_n)
    if (!f || c.at < f.at) first.set(c.pub_n, { id: c.player_id, at: c.at })
  }

  const scores = PLAYERS.map((p): Score => {
    const items: ScoreItem[] = []
    const pubs = game.visited[p.id].size
    if (pubs) items.push({ label: `${pubs} pub${pubs === 1 ? '' : 's'} reached`, points: pubs * SCORING.reachPub })

    const mine = game.results.filter((r) => r.player_id === p.id)
    const passed = mine.filter((r) => r.outcome === 'pass').length
    const failed = mine.length - passed
    if (passed) items.push({ label: `${passed} challenge${passed === 1 ? '' : 's'} passed`, points: passed * SCORING.challengePassed })
    if (failed) items.push({ label: `${failed} challenge${failed === 1 ? '' : 's'} failed`, points: failed * SCORING.challengeFailed })

    const firsts = [...first.entries()].filter(([, f]) => f.id === p.id).map(([n]) => n)
    if (firsts.length) {
      items.push({
        label: `First in at ${firsts.map((n) => pubByN(n).name).join(', ')}`,
        points: firsts.length * SCORING.firstIn,
      })
    }

    const jailed = game.jail.some((j) => j.player_id === p.id)
    if (jailed) items.push({ label: 'Sent to Sleepy Jail', points: SCORING.sleepyJail })

    for (const b of game.bonuses.filter((b) => b.player_id === p.id)) items.push({ label: b.reason, points: b.points })

    const snaps = photos[p.id] ?? 0
    if (snaps) items.push({ label: `${snaps} photo${snaps === 1 ? '' : 's'} on the wall`, points: snaps * SCORING.photo })

    return {
      id: p.id, pts: items.reduce((s, i) => s + i.points, 0), rank: 0,
      pubs, passed, failed, firstIn: firsts.length, jailed: game.inJail.has(p.id), items,
    }
  })

  // Highest first; ties broken by pubs reached, then name. Equal points share a rank.
  scores.sort((a, b) => b.pts - a.pts || b.pubs - a.pubs || name(a.id).localeCompare(name(b.id)))
  scores.forEach((s, i) => (s.rank = i > 0 && scores[i - 1].pts === s.pts ? scores[i - 1].rank : i + 1))
  return scores
}

const name = (id: PlayerId) => PLAYERS.find((p) => p.id === id)!.name

export const ordinal = (n: number) => `${n}${n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH'}`
