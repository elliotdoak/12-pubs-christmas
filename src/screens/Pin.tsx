import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AvatarBox, Screen, TopBar } from '../components/ui'
import { PinPad } from '../components/PinPad'
import { usePlayers } from '../hooks/usePlayers'
import { CLAIM_MESSAGES, claimPlayer } from '../lib/api'
import { useSession } from '../lib/session'
import { COSTUMES, PLAYERS, type PlayerId } from '../data/crawl'

export default function Pin() {
  const { id } = useParams<{ id: PlayerId }>()
  const nav = useNavigate()
  const { refresh } = useSession()
  const { players } = usePlayers()
  const [first, setFirst] = useState<string | null>(null) // new PIN, waiting for confirmation

  const base = PLAYERS.find((p) => p.id === id)
  const row = players?.find((p) => p.id === id)
  const isNew = row ? !row.has_pin : null

  const onComplete = useCallback(
    async (pin: string): Promise<string | null> => {
      if (!id) return null
      if (isNew && first === null) {
        setFirst(pin)
        return '' // clear the dots for the confirmation entry
      }
      if (isNew && first !== pin) {
        setFirst(null)
        return "PINS DIDN'T MATCH. START AGAIN."
      }
      const res = await claimPlayer(id, pin)
      if (!res.ok) {
        if (isNew) setFirst(null)
        return CLAIM_MESSAGES[res.error ?? 'network'].toUpperCase()
      }
      await refresh()
      nav('/lobby', { replace: true })
      return null
    },
    [id, isNew, first, refresh, nav],
  )

  if (!base) return <Navigate to="/who" replace />

  const heading = isNew === null ? '…' : isNew ? (first === null ? 'CHOOSE A PIN' : 'CONFIRM YOUR PIN') : 'ENTER YOUR PIN'
  const hint = isNew
    ? first === null
      ? "4 digits. You'll need it if you switch phones, so keep it simple."
      : 'Type the same 4 digits again.'
    : `${base.name} has already joined. Enter the PIN you chose.`

  return (
    <Screen>
      <TopBar back="/who" step="LAST STEP" />
      <div className="flex flex-1 flex-col items-center gap-5 px-[18px] pb-8 pt-2">
        <div className="flex items-center gap-3 self-stretch border-4 border-ink bg-wool p-3 text-ink">
          <AvatarBox id={base.id} />
          <div>
            <b className="text-[18px] leading-[22px]">{base.name}</b>
            <div className="text-[14px] leading-[18px] text-muted">{COSTUMES[base.costume].name}</div>
          </div>
        </div>
        <h1 className="m-0 text-center font-pix text-[18px] leading-[24px] text-yolk [text-shadow:3px_3px_0_var(--color-ink)]">{heading}</h1>
        <p className="m-0 max-w-[300px] text-center text-[16px] leading-[20px]">{hint}</p>
        <PinPad onComplete={onComplete} disabled={isNew === null} />
      </div>
    </Screen>
  )
}
