import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar, Knit } from './ui'
import { ScrollLock } from './Sheet'
import { computeAwards, type Award, type AwardsResult } from '../lib/awards'
import { PLAYERS, type PlayerId } from '../data/crawl'
import type { GameState } from '../hooks/useGame'

const name = (id: PlayerId) => PLAYERS.find((p) => p.id === id)?.name ?? id
const names = (ids: PlayerId[]) => (ids.length > 1 ? `${ids.slice(0, -1).map(name).join(', ')} & ${name(ids[ids.length - 1])}` : name(ids[0]))

/**
 * Champion, podium and the night's awards. In ceremony mode every award starts face down, and each
 * phone taps through them in its own time.
 */
export function AwardsBoard({ result, ceremony }: { result: AwardsResult; ceremony: boolean }) {
  const { champions, runnersUp, awards } = result
  const [shown, setShown] = useState<Set<string>>(() => new Set(ceremony ? [] : awards.map((a) => a.key)))
  const covers = useRef<Record<string, HTMLButtonElement | null>>({})
  const left = awards.filter((a) => !shown.has(a.key)).length

  const reveal = (key: string) => {
    const next = new Set(shown).add(key)
    setShown(next)
    // Move focus to the next face-down award, so a keyboard or screen reader user can keep going
    const following = awards.find((a) => !next.has(a.key))
    if (following) requestAnimationFrame(() => covers.current[following.key]?.focus({ preventScroll: true }))
  }

  return (
    <div className="flex flex-col">
      {champions.length > 0 && (
        <div className="panel relative mx-[14px] mt-4 flex flex-col items-center !bg-yolk px-3 pb-4 pt-3 text-center">
          <img src="/sprites/awards/trophy.svg" alt="" width={48} height={48} className="pixel anim-bob" />
          <div className="mt-1 font-pix text-[10px]">{champions.length > 1 ? 'JOINT CHAMPIONS' : 'CHAMPION OF THE CRAWL'}</div>
          <div className="mt-3 flex justify-center gap-3">
            {champions.map((c) => (
              <span key={c.id} className="border-4 border-ink bg-wool">
                <Avatar id={c.id} size={champions.length > 1 ? 64 : 88} />
              </span>
            ))}
          </div>
          <div className="mt-3 font-pix text-[16px] leading-[22px]">{names(champions.map((c) => c.id)).toUpperCase()}</div>
          <div className="mt-2 font-pix text-[26px] leading-[30px] text-red [text-shadow:2px_2px_0_var(--color-ink)]">
            {champions[0].pts} <small className="text-[11px] text-ink [text-shadow:none]">PTS</small>
          </div>
          {champions.length === 1 && (
            <div className="mt-2 text-[16px] leading-[20px] text-muted">
              {champions[0].pubs} pubs · {champions[0].passed} challenges passed
            </div>
          )}
        </div>
      )}

      {runnersUp.length > 0 && (
        <div className="mx-[14px] mt-3 grid grid-cols-2 gap-[10px]">
          {runnersUp.map((s) => (
            <div key={s.id} className={`flex min-w-0 items-center gap-2 border-[3px] border-ink p-2 text-ink shadow-[4px_4px_0_var(--color-ink)] ${s.rank === 2 ? 'bg-[#D9D9E0]' : 'bg-[#E3A36B]'}`}>
              <span className="shrink-0 border-2 border-ink bg-wool"><Avatar id={s.id} size={38} /></span>
              <span className="min-w-0">
                <span className="block font-pix text-[9px]">{s.rank === 2 ? '2ND' : '3RD'}</span>
                <b className="block truncate text-[17px] leading-[19px]">{name(s.id)}</b>
                <span className="font-pix text-[9px]">{s.pts}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mx-[14px] mb-[10px] mt-6 flex items-center justify-between gap-3">
        <h2 className="m-0 font-pix text-[11px] text-yolk">THE AWARDS</h2>
        {left > 1 && (
          <button type="button" className="btn-text !p-1 !text-[8px]" onClick={() => setShown(new Set(awards.map((a) => a.key)))}>
            SHOW ALL
          </button>
        )}
      </div>

      <ul className="m-0 mx-[14px] flex list-none flex-col gap-3 p-0">
        {awards.map((a, i) => (
          <li key={a.key} className="relative">
            <AwardCard award={a} />
            {!shown.has(a.key) && (
              <button
                ref={(el) => { covers.current[a.key] = el }}
                type="button"
                onClick={() => reveal(a.key)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-[6px] border-4 border-ink bg-ink font-pix text-yolk"
              >
                <span className="text-[9px]">AWARD {i + 1} OF {awards.length}</span>
                <span className="text-[22px] text-white">?</span>
                <span className="text-[8px] text-[#D8D2C6]">TAP TO REVEAL</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function AwardCard({ award: a }: { award: Award }) {
  const head = a.tone === 'gm' ? 'bg-pine text-white' : a.tone === 'away' ? 'bg-red-dark text-white' : 'bg-ink text-yolk'
  return (
    <div className={`anim-pop border-4 border-ink text-ink shadow-[5px_5px_0_var(--color-ink)] ${a.tone === 'away' ? 'bg-blush' : 'bg-wool'}`}>
      <div className={`flex items-center gap-[10px] px-[10px] py-2 ${head}`}>
        <img src={`/sprites/awards/${a.icon}.svg`} alt="" width={24} height={24} className="pixel" />
        <h3 className="m-0 font-pix text-[10px] leading-[13px]">{a.title}</h3>
      </div>
      <div className="flex items-center gap-3 p-[10px]">
        <div className="flex shrink-0 -space-x-3">
          {a.winners.slice(0, 3).map((id) => (
            <span key={id} className="border-[3px] border-ink bg-white"><Avatar id={id} size={46} /></span>
          ))}
        </div>
        <div className="min-w-0">
          <b className="block text-[19px] leading-[21px]">{names(a.winners)}</b>
          <span className="mt-1 block font-pix text-[9px] leading-[13px] text-red">{a.stat}</span>
          <span className="mt-1 block text-[15px] leading-[18px] text-muted">{a.quip}</span>
        </div>
      </div>
    </div>
  )
}

/** The full-screen awards ceremony. Shown once to each phone when the GM ends the crawl, or as a preview. */
export function AwardsShow({ game, onClose, label = 'THE NIGHT IS OVER', done = 'TO THE SCORES ▶' }: { game: GameState; onClose: () => void; label?: string; done?: string }) {
  const result = useMemo(() => computeAwards(game), [game])
  const close = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  // Focus once on open (live data refreshes re-render this, and mustn't yank focus back)
  useEffect(() => {
    close.current?.focus({ preventScroll: true })
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="awards-title"
      className="fixed inset-0 z-[75] overflow-y-auto overscroll-contain bg-red text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
    >
      <ScrollLock />
      <Knit />
      <header className="flex items-start justify-between gap-3 px-[18px] pb-1 pt-4">
        <div>
          <div className="font-pix text-[9px] text-yolk">{label}</div>
          <h1 id="awards-title" className="m-0 mt-2 font-pix text-[22px] leading-[30px] [text-shadow:3px_3px_0_var(--color-ink)]">THE AWARDS</h1>
          <p className="m-0 mt-1 text-[16px] leading-[20px] text-[#FFE7EA]">12 Pubs of Christmas · 28 November 2026</p>
        </div>
        <button ref={close} type="button" onClick={onClose} aria-label="Close the awards" className="shrink-0 border-4 border-ink bg-wool px-[10px] py-1 font-pix text-[14px] text-ink">
          ×
        </button>
      </header>
      <AwardsBoard result={result} ceremony />
      <div className="mx-[14px] mt-6">
        <button type="button" className="btn-big" onClick={onClose}>{done}</button>
      </div>
    </div>,
    document.body,
  )
}
