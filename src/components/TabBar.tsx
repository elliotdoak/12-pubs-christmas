import { NavLink } from 'react-router-dom'
import { useSession } from '../lib/session'
import { DRUNK_LEVELS, useDrunk } from '../lib/drunk'

const ICONS = {
  players: 'M2 0h3v1h-3zM1 1h5v3h-5zM2 4h3v1h-3zM0 6h7v4h-7zM8 1h2v1h-2zM7 2h4v2h-4zM8 4h2v1h-2zM8 6h4v4h-4z',
  map: 'M0 1h4v9h-4zM4 0h4v9h-4zM8 1h4v9h-4z',
  scores: 'M2 0h8v5h-8zM0 1h2v1h-2zM10 1h2v1h-2zM0 2h1v2h-1zM11 2h1v2h-1zM1 4h1v1h-1zM10 4h1v1h-1zM3 5h6v1h-6zM5 6h2v2h-2zM3 8h6v2h-6z',
  gm: 'M5 0h2v2h-2zM2 2h8v2h-8zM1 4h10v4h-10zM3 8h6v2h-6z',
  photos: 'M4 0h4v2h4v8h-12v-8h4zM5 4v4h2v-4zM4 5h4v2h-4z',
  pint: 'M2 0h7v2h-7zM2 2h1v7h-1zM8 2h1v7h-1zM3 4h5v5h-5zM9 3h2v1h-2zM10 4h1v3h-1zM9 7h2v1h-2zM2 9h7v1h-7z',
}

/** Bottom tab bar, as in the prototype. */
export function TabBar() {
  const { isGm } = useSession()
  const { level, cycle } = useDrunk()
  const tabs: [string, string, keyof typeof ICONS][] = [
    ['/lobby', 'CREW', 'players'],
    ['/map', 'MAP', 'map'],
    ['/scores', 'SCORES', 'scores'],
    ['/photos', 'PHOTOS', 'photos'],
  ]
  if (isGm) tabs.push(['/gm', 'GM', 'gm'])

  return (
    <nav
      className="sticky bottom-0 z-20 mt-auto flex gap-1 bg-ink px-2 pt-[10px]"
      style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
      aria-label="Main"
    >
      {tabs.map(([to, label, icon]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center gap-[6px] py-[10px] font-pix text-[8px] no-underline ${isActive ? 'bg-yolk text-ink' : 'text-wool'}`
          }
        >
          <svg width="24" height="20" viewBox="0 0 12 10" shapeRendering="crispEdges" aria-hidden="true">
            <path d={ICONS[icon]} fill="currentColor" />
          </svg>
          {label}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={cycle}
        aria-pressed={level > 0}
        aria-label={`Drunk Eyes: ${DRUNK_LEVELS[level].toLowerCase()}. Tap to change.`}
        className={`flex min-w-0 flex-1 flex-col items-center gap-[6px] py-[10px] font-pix text-[8px] ${level ? 'bg-red text-yolk' : 'text-wool'}`}
      >
        <svg width="24" height="20" viewBox="0 0 12 10" shapeRendering="crispEdges" aria-hidden="true" className={level ? 'anim-bob' : ''}>
          <path d={ICONS.pint} fill="currentColor" />
        </svg>
        <span className="flex items-center gap-[3px]">
          DRUNK
        </span>
        <span className="flex gap-[3px]" aria-hidden="true">
          {[1, 2, 3].map((l) => <i key={l} className={`block h-[5px] w-[5px] ${l <= level ? 'bg-yolk' : 'bg-wool/30'}`} />)}
        </span>
      </button>
    </nav>
  )
}
