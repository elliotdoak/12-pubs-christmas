import { Sheet, SheetClose } from './Sheet'
import { useState } from 'react'
import { Avatar } from './ui'
import { Lightbox, Polaroid, SnapButton, thumbPath } from './PhotoBits'
import { PHOTO_LIMIT, useSignedUrls } from '../lib/photos'
import type { PhotoRow } from '../hooks/useGame'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { BLINDFOLD_RULES, PAIRS, PLAYERS, SCORING, niceTime, pubByN, sprite } from '../data/crawl'

export function PubSheet({ n, onClose }: { n: number; onClose: () => void }) {
  const { playerId } = useSession()
  const { game } = useGameCtx()
  const pub = pubByN(n)
  const mine = playerId ? game.visited[playerId] : new Set<number>()
  const unlocked = mine.has(n)
  const here = !!playerId && game.lastPub[playerId] === n
  // Your next pub is open for a look ahead: challenge and rules show, photos wait until you arrive
  const upNext = !unlocked && !!playerId && n === (game.lastPub[playerId] ?? 0) + 1
  const open = unlocked || upNext
  const verdict = playerId ? game.result(playerId, n) : undefined
  const reached = PLAYERS.filter((p) => game.visited[p.id].has(n))
  const cuffs = n === 3 || n === 4
  const myGroup = playerId ? PAIRS.find((g) => g.includes(playerId)) : undefined

  const state = verdict === 'pass' ? 'YOU CLEARED IT' : verdict === 'fail' ? 'YOU FAILED IT' : here ? 'YOU ARE HERE' : unlocked ? 'UNLOCKED FOR YOU' : upNext ? 'UP NEXT' : 'LOCKED FOR YOU'

  return (
    <Sheet label={`Pub ${n}: ${pub.name}`} onClose={onClose}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-ink font-pix text-[14px] ${unlocked ? 'bg-red text-white' : 'bg-white'}`}>{n}</span>
        <div className="min-w-0 flex-1">
          <div className={`font-pix text-[9px] ${open ? 'text-pine' : 'text-red'}`}>PUB {n} · {state}</div>
          <h2 className="m-0 mt-1 font-pix text-[15px] leading-[20px]">{pub.name.toUpperCase()}</h2>
        </div>
        <SheetClose onClose={onClose} />
      </div>

      <div className="mx-4 flex justify-between bg-ink px-3 py-2 font-pix text-[9px] text-yolk">
        <span>ARRIVE {niceTime(pub.arrive).toUpperCase()}</span>
        <span>{pub.stay.toUpperCase()}</span>
      </div>

      <div className="relative mx-4 mt-3 flex h-[132px] items-center justify-center border-[3px] border-ink bg-sky">
        <img src={sprite.pub(n)} alt="" width={150} height={120} className={`pixel ${open ? '' : 'opacity-50 grayscale-[60%]'}`} />
        {!open && <img src="/sprites/ui/lock.svg" alt="" width={48} height={44} className="pixel absolute" />}
        {pub.demolished && <span className="absolute bottom-1 left-1 bg-ink px-1 font-pix text-[7px] text-yolk">KNOCKED DOWN. STILL COUNTS.</span>}
      </div>
      <p className="mx-4 my-2 text-[14px] leading-[18px] text-muted">{pub.address}</p>

      <div className="mx-4 flex items-center gap-2 border-[3px] border-dashed border-ink px-2 py-2">
        <span className="shrink-0 font-pix text-[8px]">UNLOCKED BY {reached.length}/{PLAYERS.length}</span>
        <div className="flex flex-wrap gap-[2px]">
          {reached.map((p) => <Avatar key={p.id} id={p.id} size={22} />)}
        </div>
      </div>

      {open ? (
        <div className="mx-4 mt-3 flex flex-col gap-3">
          <Box label="CHALLENGE" tone="pine">{pub.challenge}</Box>
          <Box label="IF YOU FAIL…" tone="red">{pub.forfeit ?? 'No forfeit set for this pub. Pride is the only casualty.'}</Box>
          {pub.note && <Box label="NOTE" tone="royal">{pub.note}</Box>}
          {cuffs && (
            <Box label="RULES:" tone="royal">
              {myGroup && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[15px]">You're cuffed to</span>
                  {myGroup.filter((id) => id !== playerId).map((id) => (
                    <span key={id} className="flex items-center gap-1">
                      <Avatar id={id} size={24} />
                      <b className="text-[15px]">{PLAYERS.find((p) => p.id === id)?.name}</b>
                    </span>
                  ))}
                  {myGroup.length === 1 && <span className="text-[15px] text-muted">[TK] nobody yet</span>}
                </div>
              )}
              <ol className="m-0 list-decimal pl-5 text-[15px] leading-[20px]">
                {BLINDFOLD_RULES.map((r) => <li key={r}>{r}</li>)}
              </ol>
            </Box>
          )}
        </div>
      ) : (
        <div className="mx-4 mt-3 border-[3px] border-ink bg-white p-4 text-center">
          <div className="font-pix text-[11px] leading-[16px]">LOCKED</div>
          <p className="m-0 mt-2 text-[16px] leading-[20px]">
            The challenge unlocks when <b>you</b> reach {pub.name}. The game checks you in automatically.
          </p>
        </div>
      )}

      {unlocked && <PubPhotos n={n} />}
    </Sheet>
  )
}

function Box({ label, tone, children }: { label: string; tone: 'pine' | 'red' | 'royal'; children: React.ReactNode }) {
  const c = { pine: 'text-pine', red: 'text-red', royal: 'text-royal' }[tone]
  return (
    <div className="border-[3px] border-ink bg-white p-3">
      <div className={`mb-1 font-pix text-[9px] ${c}`}>{label}</div>
      <div className="text-[17px] leading-[22px]">{children}</div>
    </div>
  )
}

/** Photos taken at this pub, plus a snap button. Only shown once you've unlocked the pub. */
function PubPhotos({ n }: { n: number }) {
  const { game } = useGameCtx()
  const [open, setOpen] = useState<PhotoRow | null>(null)
  const { playerId } = useSession()
  const list = game.photos.filter((p) => p.pub_n === n)
  const mineHere = list.filter((p) => p.player_id === playerId).length
  const url = useSignedUrls(list.slice(0, 8).map((p) => thumbPath(p.path)))
  return (
    <div className="mx-4 mt-3 border-[3px] border-ink bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-pix text-[9px] text-royal">PHOTOS FROM HERE ({list.length})</span>
        {mineHere >= PHOTO_LIMIT ? (
          <span className="border-2 border-ink bg-white px-2 py-[6px] font-pix text-[8px] text-muted">{PHOTO_LIMIT}/{PHOTO_LIMIT} POSTED</span>
        ) : (
          <SnapButton pub={n} className="border-2 border-ink bg-yolk px-2 py-[6px] font-pix text-[8px]">+ SNAP ({mineHere}/{PHOTO_LIMIT})</SnapButton>
        )}
      </div>
      {list.length ? (
        <div className="grid grid-cols-4 gap-2">
          {list.slice(0, 8).map((p) => (
            <Polaroid key={p.id} small photo={p} url={url(thumbPath(p.path))} onOpen={() => setOpen(p)} />
          ))}
        </div>
      ) : (
        <p className="m-0 text-[14px] leading-[18px] text-muted">No photos here yet. +{SCORING.photo} points for the first one you post.</p>
      )}
      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
