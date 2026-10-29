import { useState } from 'react'
import { Avatar, Knit, Screen } from '../components/ui'
import { TabBar } from '../components/TabBar'
import { Sheet, SheetClose } from '../components/Sheet'
import { useSession } from '../lib/session'
import { COSTUMES, PLAYERS, sprite, type Player } from '../data/crawl'

/** Hall of Fame: every costume has been done before. This is the reference for recreating it. */
export default function Costumes() {
  const { playerId } = useSession()
  const [open, setOpen] = useState<Player | null>(null)
  const me = PLAYERS.find((p) => p.id === playerId)
  // Oldest first, so the grid reads as ten years of crawls
  const byYear = [...PLAYERS].sort((a, b) => (COSTUMES[a.costume].year ?? 9999) - (COSTUMES[b.costume].year ?? 9999))

  return (
    <Screen>
      <Knit />
      <header className="flex flex-col gap-2 px-[18px] pb-3 pt-4">
        <div className="font-pix text-[10px] text-yolk">HALL OF FAME · 10 YEARS</div>
        <h1 className="m-0 font-pix text-[22px] leading-[28px] text-white [text-shadow:3px_3px_0_var(--color-ink)]">COSTUMES</h1>
        <p className="m-0 text-[15px] leading-[19px] text-blush">Every costume has been done before. Recreate the original.</p>
      </header>

      {me && <Feature player={me} onOpen={() => setOpen(me)} />}

      <div className="mx-[14px] mb-2 font-pix text-[9px] text-yolk">THE WHOLE CREW</div>
      <div className="mx-[14px] mb-5 grid grid-cols-3 gap-[10px]">
        {byYear.map((p, i) => {
          const c = COSTUMES[p.costume]
          const mine = p.id === playerId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(p)}
              aria-label={`${c.name}, worn by ${p.name}${c.year ? `, from ${c.year}` : ''}`}
              className={`anim-pop relative flex flex-col items-center gap-[6px] border-[3px] px-1 pb-2 pt-3 text-ink ${mine ? 'border-yolk bg-wool shadow-[0_0_0_3px_var(--color-ink)]' : 'border-ink bg-wool'}`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              {c.year && <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 border-2 border-ink bg-yolk px-1 font-pix text-[7px] leading-[10px]">{c.year}</span>}
              <img src={sprite.costume(p.costume)} alt="" width={56} height={56} className="pixel" />
              <span className="text-center font-pix text-[7px] leading-[10px]">{c.name.toUpperCase()}</span>
              <span className="text-[13px] font-medium leading-[16px] text-muted">{mine ? 'You' : p.name}</span>
            </button>
          )
        })}
      </div>

      <TabBar />
      {open && <CostumeSheet player={open} mine={open.id === playerId} onClose={() => setOpen(null)} />}
    </Screen>
  )
}

function Feature({ player, onOpen }: { player: Player; onOpen: () => void }) {
  const c = COSTUMES[player.costume]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-[14px] mb-5 flex items-center gap-[14px] border-4 border-ink bg-wool p-3 text-left text-ink shadow-[6px_6px_0_var(--color-ink)]"
    >
      <span className="flex h-[124px] w-[124px] shrink-0 items-center justify-center border-[3px] border-ink bg-sky">
        <img src={sprite.costume(player.costume)} alt="" width={112} height={112} className="pixel anim-bob" />
      </span>
      <span className="flex min-w-0 flex-col gap-[6px]">
        <span className="font-pix text-[9px] text-red">YOUR COSTUME</span>
        <span className="font-pix text-[13px] leading-[18px]">{c.name.toUpperCase()}</span>
        <span className="text-[15px] leading-[19px] text-muted">
          {c.year ? `The ${c.year} original` : 'To be confirmed'}
          {c.note ? ` · ${c.note}` : ''}
        </span>
        <span className="mt-1 self-start border-2 border-ink bg-ink px-2 py-1 font-pix text-[8px] text-yolk">SEE THE ORIGINAL ▸</span>
      </span>
    </button>
  )
}

/** Costume details with the original photo. Also opened from the CREW screen. */
export function CostumeSheet({ player, mine, onClose }: { player: Player; mine: boolean; onClose: () => void }) {
  const c = COSTUMES[player.costume]
  // Duo costumes: show the partner (anyone else wearing the same costume name)
  const partner = PLAYERS.find((p) => p.id !== player.id && COSTUMES[p.costume].name === c.name)
  const [big, setBig] = useState(false)

  return (
    <Sheet label={`${c.name} costume`} onClose={onClose}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="font-pix text-[9px] text-red">{c.year ? `HALL OF FAME · ${c.year}` : 'HALL OF FAME'}</div>
          <h2 className="m-0 mt-1 font-pix text-[15px] leading-[20px]">{c.name.toUpperCase()}</h2>
        </div>
        <SheetClose onClose={onClose} />
      </div>

      {big && c.photo && (
        <div className="mx-4 mb-3 flex justify-center">
          <button type="button" onClick={() => setBig(false)} aria-label="Back to the costume" className="block max-w-full border-[3px] border-ink p-0">
            <img src={c.photo} alt={`The original ${c.name} costume`} className="block max-h-[70dvh] max-w-full" />
            <span className="block bg-yolk py-1 text-center font-pix text-[8px] text-ink">TAP TO CLOSE</span>
          </button>
        </div>
      )}

      <div className="mx-4 grid grid-cols-2 gap-3">
        <div className="flex aspect-[3/4] items-center justify-center border-[3px] border-ink bg-sky">
          <img src={sprite.costume(player.costume)} alt="" width={112} height={112} className="pixel anim-bob" />
        </div>
        {c.photo ? (
          // Photo fills the tile (trimmed to fit, anchored at the top); tap to see the whole thing
          <button type="button" onClick={() => setBig(true)} aria-label="Show the original photo bigger" className="relative block aspect-[3/4] overflow-hidden border-[3px] border-ink p-0">
            <img src={c.photo} alt={`The original ${c.name} costume${c.year ? ` from ${c.year}` : ''}`} className="h-full w-full object-cover object-top" />
            <span className="absolute bottom-1 right-1 bg-yolk px-1 font-pix text-[7px] text-ink">ZOOM</span>
          </button>
        ) : (
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 border-[3px] border-dashed border-ink bg-white p-3 text-center">
            <span className="font-pix text-[8px] leading-[12px] text-muted">ORIGINAL PHOTO</span>
            <span className="text-[14px] leading-[18px] text-muted">Coming soon</span>
          </div>
        )}
      </div>

      <div className="mx-4 mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 border-[3px] border-ink bg-white p-3">
          <span className="border-2 border-ink bg-white">
            <Avatar id={player.id} size={36} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-pix text-[8px] text-pine">{mine ? "YOU'RE WEARING THIS" : 'WORN THIS YEAR BY'}</div>
            <b className="text-[17px]">{mine ? 'You' : player.name}</b>
          </div>
          <span className={`tag ${c.confirmed ? 'bg-pine text-white' : 'bg-white text-ink'}`}>{c.confirmed ? 'SORTED' : 'TBC'}</span>
        </div>

        {partner && (
          <div className="flex items-center gap-3 border-[3px] border-ink bg-white p-3">
            <span className="border-2 border-ink bg-white">
              <Avatar id={partner.id} size={36} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-pix text-[8px] text-royal">DUO COSTUME WITH</div>
              <b className="text-[17px]">{partner.name}</b>
              <div className="text-[13px] text-muted">{COSTUMES[partner.costume].name}</div>
            </div>
          </div>
        )}

        <p className="m-0 border-[3px] border-dashed border-ink p-3 text-center text-[16px] leading-[20px]">
          {c.year ? `First worn on the ${c.year} crawl. Copy the original as closely as you can.` : 'Costume to be confirmed by the organiser.'}
        </p>
      </div>
    </Sheet>
  )
}
