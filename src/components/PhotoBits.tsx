import { useRef, useState, type ReactNode } from 'react'
import { Sheet, SheetClose } from './Sheet'
import { Avatar } from './ui'
import { SnapSheet } from './SnapSheet'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { deletePhoto, thumbPath, useSignedUrls } from '../lib/photos'
import { supabase } from '../lib/supabase'
import type { PhotoRow, ReactionRow } from '../hooks/useGame'
import { PLAYERS, pubByN } from '../data/crawl'

/** The quick-pick reactions, WhatsApp style, with a Christmas crawl twist. */
export const REACTIONS = ['🔥', '❤️', '😂', '😮', '😈', '🍻', '🎄'] as const

/** Each emoji used on a photo, most popular first, with how many people picked it. */
function tally(list: ReactionRow[]) {
  const counts = new Map<string, number>()
  for (const r of list) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

/** The little bubble on a photo's corner: top emojis and the total, like WhatsApp. */
function ReactionBubble({ list }: { list: ReactionRow[] }) {
  if (!list.length) return null
  const top = tally(list).slice(0, 3)
  return (
    <span className="absolute bottom-1 left-1 flex items-center gap-[2px] rounded-full border-2 border-ink bg-white px-[6px] py-[1px] text-[13px] leading-[18px] text-ink">
      {top.map(([e]) => <span key={e}>{e}</span>)}
      {list.length > 1 && <b className="ml-[2px] text-[12px]">{list.length}</b>}
    </span>
  )
}

export const playerName = (id: string) => PLAYERS.find((p) => p.id === id)?.name ?? id
export const photoTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).replace(' ', '').replace(':', '.')

/** Polaroid-style thumbnail. */
export function Polaroid({ photo, url, tilt = 0, onOpen, small = false }: {
  photo: PhotoRow; url?: string; tilt?: number; onOpen: () => void; small?: boolean
}) {
  const { game } = useGameCtx()
  const reactions = game.reactions.filter((r) => r.photo_id === photo.id)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Photo by ${playerName(photo.player_id)}${photo.caption ? `: ${photo.caption}` : ''}${reactions.length ? `, ${reactions.length} reaction${reactions.length === 1 ? '' : 's'}` : ''}`}
      className="flex flex-col border-[3px] border-ink bg-white p-[6px] pb-2 text-left text-ink shadow-[3px_3px_0_var(--color-ink)]"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <span className={`relative block w-full overflow-hidden bg-[#2A2A33] ${small ? 'aspect-square' : 'aspect-[4/5]'}`}>
        {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="anim-blink flex h-full items-center justify-center font-pix text-[8px] text-wool">LOADING</span>}
        <ReactionBubble list={reactions} />
      </span>
      {!small && (
        <>
          {photo.caption && <b className="mt-[6px] line-clamp-2 text-[14px] leading-[17px]">{photo.caption}</b>}
          <span className="mt-[2px] text-[12px] leading-[15px] text-muted">{playerName(photo.player_id)} · {photoTime(photo.created_at)}</span>
        </>
      )}
    </button>
  )
}

/** Full-size view with tags, and delete for your own photos (or the Game Master). */
export function Lightbox({ photo, onClose }: { photo: PhotoRow; onClose: () => void }) {
  const { playerId, isGm } = useSession()
  const { game } = useGameCtx()
  const url = useSignedUrls([photo.path])(photo.path)
  const [confirm, setConfirm] = useState(false)
  const canDelete = photo.player_id === playerId || isGm

  const remove = async () => {
    if (await deletePhoto(photo.id, photo.path)) {
      await game.reload()
      onClose()
    }
  }

  return (
    <Sheet label="Photo" onClose={onClose}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <div className="font-pix text-[9px] text-red">{photo.pub_n ? `PUB ${photo.pub_n} · ${pubByN(photo.pub_n).name.toUpperCase()}` : 'BEFORE THE CRAWL'}</div>
          <div className="mt-1 text-[15px] text-muted">{playerName(photo.player_id)} · {photoTime(photo.created_at)}</div>
        </div>
        <SheetClose onClose={onClose} />
      </div>
      <div className="mx-4 border-[3px] border-ink bg-[#2A2A33]">
        {url ? <img src={url} alt={photo.caption ?? 'Photo'} className="block max-h-[60dvh] w-full object-contain" /> : <div className="anim-blink flex h-[40dvh] items-center justify-center font-pix text-[10px] text-wool">LOADING…</div>}
      </div>
      {photo.caption && <p className="m-0 px-4 pt-3 text-[18px] font-bold leading-[22px]">{photo.caption}</p>}
      <Reactions photoId={photo.id} />
      {photo.tagged.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <span className="font-pix text-[8px]">IN IT:</span>
          {photo.tagged.map((id) => (
            <span key={id} className="flex items-center gap-1 border-2 border-ink bg-white pr-2">
              <Avatar id={id} size={22} />
              <span className="text-[13px] font-bold">{playerName(id)}</span>
            </span>
          ))}
        </div>
      )}
      {canDelete && (
        <div className="flex items-center justify-end gap-2 px-4 pt-4">
          {confirm ? (
            <>
              <span className="mr-auto text-[15px]">Delete this photo?</span>
              <button type="button" onClick={remove} className="border-2 border-ink bg-red px-2 py-[6px] font-pix text-[8px] text-white">DELETE</button>
              <button type="button" onClick={() => setConfirm(false)} className="border-2 border-ink bg-white px-2 py-[6px] font-pix text-[8px]">KEEP</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="border-2 border-ink bg-white px-2 py-[6px] font-pix text-[8px]">DELETE PHOTO</button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/**
 * React to a photo: tap an emoji to add yours, tap another to swap, tap yours again to take it off.
 * Underneath, who reacted with what.
 */
function Reactions({ photoId }: { photoId: string }) {
  const { playerId } = useSession()
  const { game } = useGameCtx()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const list = game.reactions.filter((r) => r.photo_id === photoId)
  const mine = list.find((r) => r.player_id === playerId)?.emoji

  const react = async (emoji: string) => {
    if (!supabase || !playerId || busy) return
    setBusy(true)
    setErr(false)
    const { error } = mine === emoji
      ? await supabase.from('photo_reactions').delete().eq('photo_id', photoId).eq('player_id', playerId)
      : await supabase.from('photo_reactions').upsert({ photo_id: photoId, player_id: playerId, emoji, created_at: new Date().toISOString() }, { onConflict: 'photo_id,player_id' })
    if (error) setErr(true)
    await game.reload()
    setBusy(false)
  }

  return (
    <div className="px-4 pt-3">
      {playerId && (
        <div className="flex items-center justify-between gap-1 border-[3px] border-ink bg-white px-1 py-1" role="group" aria-label="React to this photo">
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => react(e)}
              disabled={busy}
              aria-pressed={mine === e}
              aria-label={`React ${e}`}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-[24px] transition-transform active:scale-125 ${mine === e ? 'bg-yolk ring-2 ring-ink' : ''}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      {err && <p role="alert" className="m-0 mt-1 text-[13px] text-red">Couldn't save your reaction. Try again.</p>}
      {list.length > 0 && (
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0" aria-label="Reactions">
          {list.map((r) => (
            <li key={r.player_id} className={`flex items-center gap-1 border-2 border-ink pr-2 ${r.player_id === playerId ? 'bg-blush' : 'bg-white'}`}>
              <Avatar id={r.player_id} size={22} />
              <span className="text-[13px] font-bold">{playerName(r.player_id)}</span>
              <span className="text-[16px] leading-[18px]">{r.emoji}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A button that opens the camera / photo library, then the post sheet. */
export function SnapButton({ pub, children, className }: { pub?: number | null; children: ReactNode; className: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) setFile(f)
          e.target.value = ''
        }}
      />
      {file && <SnapSheet file={file} defaultPub={pub} onClose={() => setFile(null)} />}
    </>
  )
}

export { thumbPath }
