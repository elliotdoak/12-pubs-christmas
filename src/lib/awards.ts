import { AWAY, CREW, DRESSED, PUBS, at, clockTime, pubByN, verdictCounts, type PlayerId } from '../data/crawl'
import { deriveGame, type CheckinRow, type GameState, type JailRow, type PhotoRow, type ResultRow } from '../hooks/useGame'
import { computeScores, type Score } from './scoring'

export interface Award {
  key: string
  title: string
  /** Sprite in /sprites/awards */
  icon: string
  /** Ties share the award */
  winners: PlayerId[]
  stat: string
  quip: string
  tone?: 'gm' | 'away'
}

export interface AwardsResult {
  /** Everyone tied for first */
  champions: Score[]
  /** Next two places */
  runnersUp: Score[]
  awards: Award[]
}

const plural = (n: number, one: string, many = `${one}S`) => `${n} ${n === 1 ? one : many}`

/** The crew members with the highest (or lowest) value. Ties share. Null if nobody reaches `min`. */
function best(values: Map<PlayerId, number>, { min = 1, lowest = false } = {}) {
  const entries = [...values.entries()]
  if (!entries.length) return null
  const v = lowest ? Math.min(...entries.map((e) => e[1])) : Math.max(...entries.map((e) => e[1]))
  if (!lowest && v < min) return null
  return { ids: entries.filter((e) => e[1] === v).map((e) => e[0]), v }
}

const crewMap = (f: (id: PlayerId) => number) => new Map(CREW.map((p) => [p.id, f(p.id)]))
const isCrew = (id: PlayerId) => CREW.some((p) => p.id === id)

/**
 * The end-of-night awards, all worked out from what the app recorded on the night.
 * An award with nothing to go on (nobody jailed, no Press Bar verdict) is left out.
 */
export function computeAwards(game: GameState): AwardsResult {
  const scores = computeScores(game)
  const champions = scores.filter((s) => s.rank === 1)
  const runnersUp = scores.filter((s) => s.rank > 1 && s.rank <= 3).slice(0, 2)
  const awards: Award[] = []
  const add = (a: Omit<Award, 'winners'>, w: { ids: PlayerId[] } | null) => w && awards.push({ ...a, winners: w.ids })

  const checkins = game.checkins.filter((c) => isCrew(c.player_id))

  // Fastest Feet: first through the door at the most pubs
  const firstIn = new Map<number, CheckinRow>()
  for (const c of checkins) {
    const cur = firstIn.get(c.pub_n)
    if (!cur || c.at < cur.at) firstIn.set(c.pub_n, c)
  }
  const fast = best(crewMap((id) => [...firstIn.values()].filter((c) => c.player_id === id).length))
  add({ key: 'fast', title: 'FASTEST FEET', icon: 'boot', stat: `FIRST IN AT ${plural(fast?.v ?? 0, 'PUB')}`, quip: 'Left every pub before the pint was finished.' }, fast)

  // Paparazzi: most photos posted
  const posted = crewMap((id) => game.photos.filter((p) => p.player_id === id).length)
  const pap = best(posted)
  add({ key: 'pap', title: 'PAPARAZZI', icon: 'camera', stat: `${plural(pap?.v ?? 0, 'PHOTO')} POSTED`, quip: 'Saw the whole night through a 6-inch screen.' }, pap)

  // Most Wanted: tagged in the most photos
  const tagged = crewMap((id) => game.photos.filter((p) => p.tagged?.includes(id)).length)
  const wanted = best(tagged)
  add({ key: 'wanted', title: 'MOST WANTED', icon: 'tag', stat: `TAGGED IN ${plural(wanted?.v ?? 0, 'PHOTO')}`, quip: 'The face of the crawl, like it or not.' }, wanted)

  // Challenges: verdicts only count at pubs that have pass / fail
  const verdicts = game.results.filter((r) => verdictCounts(r.player_id, r.pub_n))
  const count = (id: PlayerId, o: ResultRow['outcome']) => verdicts.filter((r) => r.player_id === id && r.outcome === o).length
  const champ = best(crewMap((id) => count(id, 'pass')))
  add({ key: 'champ', title: 'CHALLENGE CHAMP', icon: 'star', stat: `${plural(champ?.v ?? 0, 'CHALLENGE')} PASSED`, quip: 'Did everything the Game Master asked. Suspicious.' }, champ)
  const bottle = best(crewMap((id) => count(id, 'fail')))
  add({ key: 'bottle', title: 'BOTTLE JOB', icon: 'pint', stat: `${plural(bottle?.v ?? 0, 'CHALLENGE')} FAILED`, quip: 'Talked a good game. Played a bad one.' }, bottle)

  // Jailbird: first one sent to Sleepy Jail
  const jailed = game.jail.filter((j) => isCrew(j.player_id)).sort((a, b) => a.since.localeCompare(b.since))[0]
  if (jailed) {
    awards.push({
      key: 'jail', title: 'JAILBIRD', icon: 'bars', winners: [jailed.player_id],
      stat: `SLEEPY JAIL AT ${clockTime(new Date(jailed.since).getTime()).toUpperCase()}`,
      quip: jailed.last_pub ? `First to nod off. Last seen at ${pubByN(jailed.last_pub).name}.` : 'First to nod off.',
    })
  }

  // The Ghost: in the fewest photos, posted or tagged, among people who actually came out
  if (game.photos.length >= 5) {
    const out = CREW.filter((p) => game.visited[p.id].size > 0)
    const seen = new Map(out.map((p) => [p.id, game.photos.filter((ph) => ph.player_id === p.id || ph.tagged?.includes(p.id)).length]))
    const ghost = best(seen, { lowest: true })
    if (ghost && ghost.ids.length <= 2 && out.length > 2)
      add({ key: 'ghost', title: 'THE GHOST', icon: 'ghost', stat: `IN ${plural(ghost.v, 'PHOTO')} ALL NIGHT`, quip: 'Was anyone there? The check-ins say yes.' }, ghost)
  }

  // Last One Standing: last through the door at the furthest pub anyone reached
  const furthest = Math.max(0, ...CREW.map((p) => game.lastPub[p.id]))
  if (furthest) {
    const last = checkins.filter((c) => c.pub_n === furthest).sort((a, b) => b.at.localeCompare(a.at))[0]
    awards.push({
      key: 'last', title: 'LAST ONE STANDING', icon: 'moon', winners: [last.player_id],
      stat: `LAST INTO ${pubByN(furthest).name.toUpperCase()} AT ${clockTime(new Date(last.at).getTime()).toUpperCase()}`,
      quip: 'Got there in the end. Somehow.',
    })
  }

  // Best Dressed: the Game Master's Press Bar pick
  const dressed = game.bonuses.find((b) => b.reason === DRESSED.best[0])
  if (dressed) awards.push({ key: 'dressed', title: 'BEST DRESSED', icon: 'tree', winners: [dressed.player_id], stat: "GAME MASTER'S PICK", quip: 'Showed up and showed off.', tone: 'gm' })

  // Absent Friend: whoever couldn't make it this year
  if (AWAY.length)
    awards.push({ key: 'away', title: 'ABSENT FRIEND', icon: 'heart', winners: AWAY.map((p) => p.id), stat: 'ON DAD DUTY', quip: 'Welcome to the crew, Baby Doyle. Raise a glass.', tone: 'away' })

  return { champions, runnersUp, awards }
}

/* ---------------- sample night, for the Game Master's preview ---------------- */

/**
 * A made-up but believable night: different finishing pubs, photos, verdicts, one Sleepy Jail and a
 * Press Bar pick. Fixed, so the preview looks the same every time. Never touches the database.
 */
export function sampleGame(): GameState {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const iso = (t: number) => new Date(t).toISOString()

  // How far each of the crew got, and how keen they were with the camera
  const reach: Record<string, number> = { EL: 12, RE: 12, GT: 12, HA: 12, ST: 11, GR: 12, CA: 10, HI: 12, DE: 9 }
  const snappy: Record<string, number> = { GR: 0.95, HA: 0.45, EL: 0.5, RE: 0.4, ST: 0.35, CA: 0.3, GT: 0.25, DE: 0.3, HI: 0.05 }

  const checkins: CheckinRow[] = []
  const results: ResultRow[] = []
  const photos: PhotoRow[] = []
  CREW.forEach((p) => {
    const lastN = reach[p.id] ?? 12
    for (const pub of PUBS.filter((x) => x.n <= lastN)) {
      const keen = p.id === 'ST' ? 0 : p.id === 'GT' ? 14 : 2
      const t = at(pub.arrive) + (keen + rand() * 9) * 60_000
      checkins.push({ player_id: p.id, pub_n: pub.n, at: iso(t), source: 'geo', by_player: null })
      if (!pub.judging) results.push({ player_id: p.id, pub_n: pub.n, outcome: rand() < (p.id === 'EL' ? 1 : p.id === 'CA' ? 0.5 : 0.8) ? 'pass' : 'fail', set_at: iso(t) })
      for (let k = 0; k < 3; k++) {
        if (rand() > (snappy[p.id] ?? 0.3)) continue
        const pool = CREW.filter((c) => c.id !== p.id && c.id !== 'HI')
        const tags = [pool[Math.floor(rand() * pool.length)].id]
        if (rand() < 0.2) tags.push('HA')
        photos.push({ id: `${p.id}-${pub.n}-${k}`, player_id: p.id, pub_n: pub.n, path: '', caption: null, tagged: [...new Set(tags)], created_at: iso(t + k * 60_000) })
      }
    }
  })
  const jail: JailRow[] = [{ player_id: 'DE', last_pub: 9, since: iso(at(pubByN(9).arrive) + 35 * 60_000), released_at: null }]
  const bonuses = [{ id: 1, player_id: 'RE' as PlayerId, points: DRESSED.best[1], reason: DRESSED.best[0], created_at: iso(at(PUBS[0].arrive)) }]
  return deriveGame({ checkins, results, jail, bonuses, photos, settings: { announcement: null, announced_at: null } })
}
