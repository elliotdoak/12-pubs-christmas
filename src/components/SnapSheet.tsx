import { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetClose } from './Sheet'
import { Avatar } from './ui'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { UPLOAD_MESSAGES, uploadPhoto } from '../lib/photos'
import { PLAYERS, PUBS, type PlayerId } from '../data/crawl'

/** Caption, pub and who's-in-it for a photo the player just picked, then upload. */
export function SnapSheet({ file, defaultPub, onClose }: { file: File; defaultPub?: number | null; onClose: () => void }) {
  const { playerId } = useSession()
  const { game } = useGameCtx()
  const mine = playerId ? game.visited[playerId] : new Set<number>()
  const reached = PUBS.filter((p) => mine.has(p.n))
  const [pub, setPub] = useState<number | null>(defaultPub ?? (playerId ? game.lastPub[playerId] || null : null))
  const [caption, setCaption] = useState('')
  const [tagged, setTagged] = useState<Set<PlayerId>>(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const preview = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(preview), [preview])

  const toggle = (id: PlayerId) =>
    setTagged((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const post = async () => {
    if (!playerId) return
    setBusy(true)
    setErr(null)
    const res = await uploadPhoto({ file, playerId, pub, caption, tagged: [...tagged] })
    setBusy(false)
    if (!res.ok) return setErr(UPLOAD_MESSAGES[res.error])
    navigator.vibrate?.(60)
    await game.reload()
    onClose()
  }

  return (
    <Sheet label="Post a photo" onClose={busy ? undefined : onClose}>
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="m-0 font-pix text-[14px]">POST TO THE WALL</h2>
        {!busy && <SheetClose onClose={onClose} />}
      </div>

      <div className="mx-4 -rotate-1 border-[3px] border-ink bg-white p-2 pb-3 shadow-[4px_4px_0_var(--color-ink)]">
        <img src={preview} alt="Your photo" className="block max-h-[38dvh] w-full object-contain" />
        {caption && <p className="m-0 mt-2 text-center text-[16px] font-bold leading-[20px]">{caption}</p>}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="font-pix text-[9px]">CAPTION</span>
          <input
            value={caption}
            maxLength={80}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Cuffed and loving it"
            className="border-2 border-ink bg-white p-2 text-[16px]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-pix text-[9px]">WHERE</span>
          <select
            value={pub ?? ''}
            onChange={(e) => setPub(e.target.value ? Number(e.target.value) : null)}
            className="border-2 border-ink bg-white p-2 text-[16px]"
          >
            <option value="">Before the crawl</option>
            {reached.map((p) => <option key={p.n} value={p.n}>{p.n}. {p.name}</option>)}
          </select>
          <span className="text-[13px] leading-[17px] text-muted">You can post to pubs you've reached.</span>
        </label>

        <div className="flex flex-col gap-1">
          <span className="font-pix text-[9px]">WHO'S IN IT?</span>
          <div className="grid grid-cols-5 gap-1" role="group" aria-label="Tag players">
            {PLAYERS.map((p) => {
              const on = tagged.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={`flex flex-col items-center gap-[2px] border-2 border-ink py-1 ${on ? 'bg-yolk' : 'bg-white'}`}
                >
                  <Avatar id={p.id} size={28} />
                  <span className="text-[11px] font-bold leading-[13px]">{p.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {err && <p role="alert" className="m-0 text-[15px] leading-[19px] text-red">{err}</p>}
        <button type="button" className="btn-big" disabled={busy} onClick={post}>
          {busy ? 'UPLOADING…' : 'POST IT ▶'}
        </button>
      </div>
    </Sheet>
  )
}
