import { useState } from 'react'
import { Knit, Screen } from '../components/ui'
import { TabBar } from '../components/TabBar'
import { Lightbox, Polaroid, SnapButton, thumbPath } from '../components/PhotoBits'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { useSignedUrls } from '../lib/photos'
import type { PhotoRow } from '../hooks/useGame'
import { SCORING, niceTime, pubByN } from '../data/crawl'

export default function Photos() {
  const { playerId, isGm } = useSession()
  const { game } = useGameCtx()
  const [open, setOpen] = useState<PhotoRow | null>(null)
  const mine = playerId ? game.visited[playerId] : new Set<number>()

  // Photos from pubs you haven't reached stay hidden until you get there (the GM sees everything)
  const canSee = (p: PhotoRow) => isGm || p.pub_n === null || mine.has(p.pub_n) || p.player_id === playerId
  const visible = game.photos.filter(canSee)
  const hidden = game.photos.length - visible.length
  const url = useSignedUrls(visible.map((p) => thumbPath(p.path)))

  // Group by pub, latest pub first; "before the crawl" last
  const groups = new Map<number, PhotoRow[]>()
  for (const p of visible) groups.set(p.pub_n ?? 0, [...(groups.get(p.pub_n ?? 0) ?? []), p])
  const order = [...groups.keys()].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : b - a))

  return (
    <Screen>
      <Knit />
      <header className="flex flex-col gap-2 px-[18px] pb-3 pt-4">
        <div className="font-pix text-[10px] text-yolk">THE CREW'S CAMERA ROLL</div>
        <h1 className="m-0 font-pix text-[22px] leading-[28px] text-white [text-shadow:3px_3px_0_var(--color-ink)]">PHOTO WALL</h1>
        <p className="m-0 text-[16px] leading-[20px] text-blush">
          {visible.length} photo{visible.length === 1 ? '' : 's'} on the wall
        </p>
        {/* Points in the heading font: the body font's 5 reads as a 9 at this size */}
        <div className="flex flex-wrap items-center gap-2" aria-label={`Points per pub: ${SCORING.photo.map((p, i) => `${['1st', '2nd', '3rd'][i]} photo ${p}`).join(', ')}`}>
          {SCORING.photo.map((pts, i) => (
            <span key={i} className="flex items-center gap-[6px] border-2 border-ink bg-ink px-2 py-[5px]">
              <span className="font-pix text-[8px] text-wool">{['1ST', '2ND', '3RD'][i]}</span>
              <span className="font-pix text-[11px] text-yolk">+{pts}</span>
            </span>
          ))}
          <span className="text-[15px] leading-[19px] text-blush">points per pub</span>
        </div>
        <p className="m-0 text-[15px] leading-[19px] text-blush">
          Post 3 photos minimum at every pub to maximise your points. Real photos only: spam shots lose you points.
        </p>
      </header>

      {order.length === 0 && (
        <div className="panel mx-[14px] mb-4 flex flex-col items-center gap-2 p-5 text-center">
          <div className="font-pix text-[11px]">NO PHOTOS YET</div>
          <p className="m-0 text-[16px] leading-[20px]">Be the first. Costume prep counts.</p>
        </div>
      )}

      {order.map((n) => {
        const list = groups.get(n)!
        const pub = n ? pubByN(n) : null
        return (
          <section key={n} className="mb-5" aria-label={pub ? pub.name : 'Before the crawl'}>
            <div className="mx-[14px] mb-3 flex items-center gap-2 bg-ink px-2 py-2 font-pix text-[10px] text-white">
              <span className="flex h-6 min-w-6 items-center justify-center bg-red px-1 text-yolk">{n || 'GO'}</span>
              <span className="flex-1 truncate">{pub ? pub.name.toUpperCase() : 'BEFORE THE CRAWL'}</span>
              {pub && <em className="not-italic text-yolk">{niceTime(pub.arrive).toUpperCase()}</em>}
            </div>
            <div className="mx-[14px] grid grid-cols-2 gap-3">
              {list.map((p, i) => (
                <Polaroid key={p.id} photo={p} url={url(thumbPath(p.path))} tilt={i % 2 ? 1.5 : -1.5} onOpen={() => setOpen(p)} />
              ))}
            </div>
          </section>
        )
      })}

      {hidden > 0 && (
        <p className="mx-[18px] mb-4 text-center text-[14px] leading-[18px] text-blush">
          {hidden} more photo{hidden === 1 ? '' : 's'} from pubs you haven't reached yet. Get there to see them.
        </p>
      )}

      <div style={{ bottom: 'calc(max(14px, env(safe-area-inset-bottom)) + 76px)' }} className="sticky z-10 mb-2 flex justify-end px-[14px]">
        <SnapButton
          pub={playerId ? game.lastPub[playerId] || null : null}
          className="flex items-center gap-2 border-4 border-ink bg-yolk px-4 py-3 font-pix text-[12px] text-ink shadow-[4px_4px_0_var(--color-ink)] active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          + SNAP
        </SnapButton>
      </div>

      <TabBar />
      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
    </Screen>
  )
}
