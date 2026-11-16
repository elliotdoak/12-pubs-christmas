import { useState } from 'react'
import { Sheet, SheetClose } from './Sheet'
import { BabyDash } from './BabyDash'
import { Avatar } from './ui'
import { AWAY, HOSPITAL_FAMILY } from '../data/crawl'

/** Who's in the hospital on the map: crew who can't make it this year, and why. */
export function HospitalSheet({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState(false)
  return (
    <>
    <Sheet label="Hospital" onClose={onClose}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <img src="/sprites/map/hospital.svg" alt="" width={52} height={30} className="pixel mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-pix text-[9px] text-red">{AWAY.length} CAN'T MAKE IT</div>
          <h2 className="m-0 mt-1 font-pix text-[15px] leading-[20px]">HOSPITAL</h2>
        </div>
        <SheetClose onClose={onClose} />
      </div>

      <ul className="m-0 mx-4 list-none border-[3px] border-ink bg-white p-0">
        {AWAY.map((p) => (
          <li key={p.id} className="flex items-center gap-3 border-b-2 border-dashed border-[#CFC6B6] px-3 py-3 last:border-0">
            <div className="shrink-0 border-2 border-ink bg-wool"><Avatar id={p.id} size={40} /></div>
            <div className="min-w-0 flex-1">
              <b className="text-[17px]">{p.name}</b>
            </div>
          </li>
        ))}
      </ul>

      {/* Joanna and the baby, under Div */}
      <ul className="m-0 mx-4 mt-3 list-none border-[3px] border-ink bg-white p-0">
        {HOSPITAL_FAMILY.map((f) => (
          <li key={f.src} className="flex items-center gap-3 border-b-2 border-dashed border-[#CFC6B6] px-3 py-3 last:border-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink bg-wool">
              <img src={f.src} alt="" width={f.w * 2.5} height={f.h * 2.5} className="pixel" />
            </div>
            <div className="min-w-0 flex-1">
              <b className="text-[17px]">{f.label}</b>
            </div>
          </li>
        ))}
      </ul>

      {/* Meanwhile, on the labour ward. Drawn smooth rather than pixelated, so the joke reads at a glance */}
      <figure className="mx-4 mt-3 mb-0 flex flex-col items-center gap-2 border-[3px] border-dashed border-ink px-3 py-3">
        <img
          src="/sprites/hospital/labour.svg"
          alt="Joanna in labour in a hospital bed gripping the rail, a doctor side-eyeing David, and David belting out karaoke into a microphone under a karaoke screen, with a speaker at his feet"
          width={288}
          height={160}
          className="h-auto w-full max-w-[288px]"
        />
        <figcaption className="text-center text-[14px] leading-[18px] text-muted">
          Joanna's doing the hard work. David's on karaoke.
        </figcaption>
      </figure>

      <p className="m-0 mx-4 mt-3 text-[15px] leading-[19px] text-muted">
        Not on the crawl, so not on the leaderboard. Raise a glass and send him a photo.
      </p>
      <div className="mx-4 mt-3 flex justify-center">
        <button type="button" className="btn-big" onClick={() => setPlaying(true)}>PLAY BABY DASH ▶</button>
      </div>
    </Sheet>
    {playing && <BabyDash onClose={() => setPlaying(false)} />}
    </>
  )
}
