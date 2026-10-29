import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { sprite, type PlayerId } from '../data/crawl'

/**
 * Full-height phone screen. Clears the notch/status bar at the top; the bottom is handled by
 * whatever sits there (TabBar or Footer), so the home-indicator gap isn't added twice.
 */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col ${className}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {children}
    </div>
  )
}

export function Knit() {
  return <div className="knit" aria-hidden="true" />
}

export function Logo({ size = 30 }: { size?: number }) {
  return <img src="/sprites/logo.svg" alt="" width={size} height={size} className="pixel" />
}

export function Brand({ presents = false }: { presents?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Logo />
      <span className="font-pix text-[10px] leading-[14px] text-yolk">
        <b className="font-normal">DOAK</b>
        <span className="text-white">DIGITAL</span>
        {presents && <span className="text-white"> PRESENTS</span>}
      </span>
    </div>
  )
}

export function Title({ className = '' }: { className?: string }) {
  return (
    <h1 className={`anim-drop m-0 text-center font-pix text-[26px] leading-[34px] text-yolk [text-shadow:4px_4px_0_var(--color-ink)] ${className}`}>
      12 PUBS OF
      <br />
      CHRISTMAS
    </h1>
  )
}

export function TopBar({ back, step }: { back?: string; step?: string }) {
  return (
    <div className="flex items-center justify-between px-[18px] py-3">
      {back ? (
        <Link to={back} className="font-pix text-[10px] text-white no-underline">
          ◀ BACK
        </Link>
      ) : (
        <span />
      )}
      {step && <span className="font-pix text-[10px] text-yolk">{step}</span>}
    </div>
  )
}

export function Avatar({ id, size = 36, bob = false, delay = 0 }: { id: PlayerId; size?: number; bob?: boolean; delay?: number }) {
  return (
    <img
      src={sprite.avatar(id)}
      alt=""
      width={size}
      height={size}
      className={`pixel ${bob ? 'anim-bob' : ''}`}
      style={bob ? { animationDelay: `${delay}s` } : undefined}
    />
  )
}

export function AvatarBox({ id, size = 44 }: { id: PlayerId; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center border-2 border-ink bg-white" style={{ width: size, height: size }}>
      <Avatar id={id} size={Math.round(size * 0.8)} />
    </div>
  )
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex flex-col items-center gap-2 border-t-4 border-ink bg-red-dark/40 px-4 pt-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
      {children}
    </div>
  )
}
