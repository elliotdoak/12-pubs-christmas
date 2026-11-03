import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, AvatarBox, Brand, Knit, Screen, Title } from '../components/ui'
import { Countdown } from '../components/Countdown'
import { CostumeSheet } from './Costumes'
import { TabBar } from '../components/TabBar'
import { usePlayers } from '../hooks/usePlayers'
import { releasePlayer } from '../lib/api'
import { useSession } from '../lib/session'
import { useGameCtx } from '../lib/game'
import { load, save } from '../lib/storage'
import { dropPush, syncPush } from '../lib/push'
import { isStandalone, locationState, notificationState, type PermState } from '../lib/platform'
import { COSTUMES, PLAYERS } from '../data/crawl'

export default function Lobby() {
  const nav = useNavigate()
  const { playerId, refresh } = useSession()
  const { players } = usePlayers(20_000)
  const { geo } = useGameCtx()
  const [loc, setLoc] = useState<PermState>('prompt')
  const [push, setPush] = useState(false)
  const [showCostume, setShowCostume] = useState(false)
  // Player list starts folded away; remembered per phone
  const [showPlayers, setShowPlayers] = useState(() => load('showPlayers', false))
  const togglePlayers = () => {
    setShowPlayers(!showPlayers)
    save('showPlayers', !showPlayers)
  }
  const me = PLAYERS.find((p) => p.id === playerId)!

  useEffect(() => {
    locationState().then(setLoc)
    syncPush().then(setPush)
  }, [])

  const joined = players?.filter((p) => p.has_pin).length ?? 0
  const notif = notificationState()
  const checks = [
    isStandalone() ? 'Installed' : 'In browser',
    // Alerts only count as on once this phone can actually be reached by push
    notif === 'granted' && push ? 'alerts on' : 'alerts off',
    // While the game is tracking, the live GPS state is the truth; otherwise the permission check
    geo.status === 'tracking' || (geo.status !== 'denied' && loc === 'granted') ? 'location on' : 'location off',
  ]
  const allGood = checks.every((c) => !/off|browser/.test(c))

  const switchPlayer = async () => {
    await dropPush()
    await releasePlayer()
    await refresh()
    nav('/who', { replace: true })
  }

  // Sort: me first, then joined players, then everyone else
  const rows = [...(players ?? [])].sort((a, b) =>
    a.id === playerId ? -1 : b.id === playerId ? 1 : Number(b.has_pin) - Number(a.has_pin) || a.name.localeCompare(b.name),
  )

  return (
    <Screen>
      <Knit />
      <div className="flex flex-col items-center gap-3 px-5 pb-4 pt-5">
        <Brand presents />
        <Title />
        <div className="text-[16px] font-medium text-blush">10th anniversary · {PLAYERS.length} players · 0 dignity</div>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-4">
        <Countdown />

        <div className="flex items-center gap-3 border-4 border-ink bg-wool p-2 text-ink">
          <Avatar id={me.id} size={36} bob />
          <div className="min-w-0 flex-1">
            <div className="font-pix text-[10px] leading-[14px] text-pine">
              {me.name.toUpperCase()} · {allGood ? 'READY' : 'NEARLY READY'}
            </div>
            <div className="text-[14px] leading-[18px] text-muted">{checks.join(' · ')}</div>
          </div>
          {!allGood && (
            <Link to="/install" className="font-pix text-[8px] text-red underline">
              FIX
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowCostume(true)}
          className="border-4 border-ink bg-ink px-3 py-2 text-left font-pix text-[9px] leading-[14px] text-yolk"
        >
          YOUR COSTUME: {COSTUMES[me.costume].name.toUpperCase()} ▸
        </button>
      </div>

      <section className="panel mx-[14px] mb-4 flex flex-col" aria-label="Players">
        <button
          type="button"
          onClick={togglePlayers}
          aria-expanded={showPlayers}
          aria-controls="player-list"
          className="flex w-full items-center justify-between gap-3 bg-ink px-3 py-[10px] text-left"
        >
          <b className="font-pix text-[12px] font-normal text-yolk">PLAYERS</b>
          <span className="flex items-center gap-3 font-pix text-[9px] text-white">
            {joined}/{PLAYERS.length} JOINED
            <span aria-hidden="true" className="text-yolk">{showPlayers ? '▲' : '▼'}</span>
          </span>
        </button>
        <ul id="player-list" hidden={!showPlayers} className="m-0 list-none px-3 py-0">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b-2 border-dashed border-[#E3B9BF] py-[9px] last:border-0">
              <AvatarBox id={p.id} />
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <b className="text-[17px] leading-[20px]">
                  {p.name}
                  {p.id === playerId && <span className="text-red"> (YOU)</span>}
                </b>
                <span className="text-[14px] leading-[18px] text-muted">{COSTUMES[p.costume].name}</span>
              </div>
              <span className={`tag ${p.has_pin ? 'bg-pine text-white' : 'bg-white text-ink'}`}>{p.has_pin ? 'READY' : 'NOT YET'}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col items-center pb-6">
        <button type="button" className="btn-text" onClick={switchPlayer}>
          NOT {me.name.toUpperCase()}? SWITCH PLAYER
        </button>
      </div>

      <TabBar />
      {showCostume && <CostumeSheet player={me} mine onClose={() => setShowCostume(false)} />}
    </Screen>
  )
}
