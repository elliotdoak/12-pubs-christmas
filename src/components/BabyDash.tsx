import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScrollLock, SheetClose } from './Sheet'
import { load, save } from '../lib/storage'

/*
 * Baby Dash: Div sprints across Glasgow to the hospital. Tap (or Space / Up) to hop the pints and
 * the sacks of snow; tap again in mid-air to double jump the big bald man. Hit anything and he's done. Reach the hospital door and Baby Doyle is waiting.
 * Drawn on a tall 240x320 canvas so it fills most of a phone screen, scaled up crisp. Purely for fun: nothing here touches the crawl scores.
 */

const W = 240
const H = 320
const GROUND = 290
const DIV_X = 40
const FINISH = 5400 // track length in pixels: about 25 seconds of running
const GRAVITY = 2100
// One hop peaks about 42px up: enough for a pint or a sack, not the bald man. A second tap in mid-air hops again.
const JUMP = -420
const DOOR = 74 // from the hospital's left edge to its door
// The finish: the street stops scrolling once the hospital is centred, and Div runs on to its door
const HOSPITAL_W = 104
const CAMERA_STOP = FINISH + DIV_X - (W - HOSPITAL_W) / 2
const WIN_AT = CAMERA_STOP + (W - HOSPITAL_W) / 2 + DOOR - DIV_X
/** How far the street has scrolled: follows Div until the hospital is centred, then holds */
const camera = (w: { dist: number }) => Math.min(w.dist, CAMERA_STOP)

const INK = '#1A1A1A'
const TEE = '#F6F1E7'
const JEANS = '#3B4A63'
const SKIN = '#F0CDB0'

type Phase = 'ready' | 'running' | 'crashed' | 'won'
/** Something in Div's way: 0 a stout, 1 a lager, 2 a big sack of snow, 3 the big bald man. */
interface Pint { x: number; kind: 0 | 1 | 2 | 3 }
const isSack = (p: Pint) => p.kind === 2
const isBaldy = (p: Pint) => p.kind === 3
/** Hitbox: left and right inset from the sprite's x, and how tall it stands. */
const box = (p: Pint) => (isBaldy(p) ? { l: 3, r: 12, h: 46 } : isSack(p) ? { l: 2, r: 15, h: 13 } : { l: 2, r: 10, h: 17 })
const width = (p: Pint) => (isBaldy(p) ? 15 : isSack(p) ? 17 : 12)
interface World {
  dist: number
  y: number // Div's feet
  vy: number
  /** Jumps used since last touching the ground: 2 allowed */
  jumps: number
  /** Where the double-jump puff appeared, and when */
  puff: { x: number; y: number; t: number } | null
  t: number
  pints: Pint[]
  nextPint: number
}

// Starts brisk and ends properly fast: by the end, an obstacle is on screen for well under a second
const speedAt = (dist: number) => 160 + Math.min(1, dist / FINISH) * 130

function fresh(): World {
  return { dist: 0, y: GROUND, vy: 0, jumps: 0, puff: null, t: 0, pints: [], nextPint: 300 }
}

function img(src: string) {
  const i = new Image()
  i.src = src
  return i
}

// Back-street skyline, scrolled slowly behind the action
const BUILDINGS = Array.from({ length: 14 }, (_, i) => ({ x: i * 46, w: 30 + ((i * 37) % 22), h: 90 + ((i * 53) % 120) }))
const SKYLINE = 14 * 46

export function BabyDash({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const world = useRef<World>(fresh())
  const phaseRef = useRef<Phase>('ready')
  const [phase, setPhaseState] = useState<Phase>('ready')
  const [hit, setHit] = useState<'pint' | 'sack' | 'baldy'>('pint')
  const [progress, setProgress] = useState(0)
  // Personal records, kept per phone
  const [best, setBest] = useState(() => load('babyDashBest', 0))
  const [wins, setWins] = useState(() => load('babyDashWins', 0))
  const records = useRef({ best, wins })
  const record = useCallback((pct: number, won: boolean) => {
    const r = records.current
    if (pct > r.best) save('babyDashBest', (r.best = pct))
    if (won) save('babyDashWins', (r.wins += 1))
    setBest(r.best)
    setWins(r.wins)
  }, [])

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  const jump = useCallback(() => {
    const w = world.current
    if (phaseRef.current === 'ready') setPhase('running')
    if (phaseRef.current !== 'running') return
    if (w.y >= GROUND) w.jumps = 0
    if (w.jumps >= 2) return
    if (w.jumps === 1) w.puff = { x: w.dist, y: w.y, t: w.t }
    w.jumps += 1
    w.vy = JUMP
  }, [setPhase])

  const restart = () => {
    world.current = fresh()
    setPhase('running')
  }

  // Keyboard: Space / Up to jump, Escape to leave
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (phaseRef.current === 'crashed' || phaseRef.current === 'won') return
        jump()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [jump, onClose])

  // The game loop: runs the whole time the overlay is open, and only moves the world while running
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    const art = {
      head: img('/sprites/avatars/dv.svg'),
      pints: [img('/sprites/map/stout.svg'), img('/sprites/map/lager.svg')],
      hospital: img('/sprites/map/hospital.svg'),
      wife: img('/sprites/hospital/wife.svg'),
      baby: img('/sprites/hospital/baby.svg'),
    }
    // Heavy snow: lots of flakes, a few big fat ones falling faster in front
    const snow = Array.from({ length: 230 }, (_, i) => ({ x: (i * 83) % W, y: (i * 47) % H, v: 16 + (i % 7) * 7, size: i % 6 === 0 ? 2 : 1 }))
    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      // Clamp so a phone waking up from the background doesn't teleport Div into a pint
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const w = world.current
      const running = phaseRef.current === 'running'

      if (running) {
        const speed = speedAt(w.dist)
        w.t += dt
        w.dist += speed * dt
        w.vy += GRAVITY * dt
        w.y = Math.min(GROUND, w.y + w.vy * dt)
        if (w.y >= GROUND) {
          w.vy = 0
          w.jumps = 0
        }

        // Obstacles: pints and sacks of snow, in ones and twos. Gaps always leave room to land and jump
        // again (a jump covers about 0.53s), but they tighten as the pace picks up.
        // The bald man always stands alone, with extra room after him for the longer double jump.
        const pick = (): Pint['kind'] => (w.dist > 500 && Math.random() < 0.3 ? 2 : Math.random() < 0.5 ? 0 : 1)
        while (w.nextPint < w.dist + W + 40 && w.nextPint < FINISH - 260) {
          const baldy = w.dist > 1000 && Math.random() < 0.18
          const first: Pint = { x: w.nextPint, kind: baldy ? 3 : pick() }
          w.pints.push(first)
          if (!baldy && w.dist > 600 && Math.random() < 0.35) w.pints.push({ x: w.nextPint + width(first) + 1, kind: pick() })
          w.nextPint += Math.max(speed * 0.62 + 40, speed * (0.66 + Math.random() * 0.7)) + (baldy ? speed * 0.45 : 0)
        }
        w.pints = w.pints.filter((p) => p.x - w.dist + DIV_X > -20)

        // A forgiving hitbox: Div's body against the glass (not the froth) or the sack
        for (const p of w.pints) {
          const px = p.x - w.dist + DIV_X
          const b = box(p)
          if (px + b.r > DIV_X + 2 && px + b.l < DIV_X + 9 && w.y > GROUND - b.h) {
            setHit(isBaldy(p) ? 'baldy' : isSack(p) ? 'sack' : 'pint')
            setPhase('crashed')
            record(Math.floor((w.dist / WIN_AT) * 100), false)
            navigator.vibrate?.(200)
            break
          }
        }

        if (w.dist >= WIN_AT) {
          setPhase('won')
          record(100, true)
          navigator.vibrate?.([80, 60, 80])
        }
        setProgress(Math.min(1, w.dist / WIN_AT))
      }

      draw(ctx, w, art, snow, dt, phaseRef.current)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [setPhase, record])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Baby Dash"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-ink px-3 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <ScrollLock />
      <div className="flex w-full max-w-[430px] items-center justify-between gap-3">
        <div>
          <div className="font-pix text-[9px] text-blush">MEANWHILE, ACROSS TOWN…</div>
          <h2 className="m-0 mt-1 font-pix text-[18px] leading-[24px] text-yolk [text-shadow:3px_3px_0_var(--color-red-dark)]">BABY DASH</h2>
        </div>
        <SheetClose onClose={onClose} />
      </div>

      <div
        className={`relative max-w-[430px] select-none border-4 border-wool ${phase === 'crashed' ? 'anim-shake' : ''}`}
        // As wide as the screen allows, but never so tall it runs off a short phone (the canvas is 3:4)
        style={{ touchAction: 'none', width: 'min(100%, calc((100dvh - 170px) * 0.75))' }}
        onPointerDown={(e) => {
          if (phase === 'ready' || phase === 'running') {
            e.preventDefault()
            jump()
          }
        }}
      >
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="pixel block h-auto w-full"
          aria-label="Baby Dash. Tap, or press Space, to make Div jump the pints."
        />

        {phase === 'ready' && (
          <Panel>
            <div className="font-pix text-[11px] leading-[16px] text-yolk">BABY DOYLE IS ON THE WAY!</div>
            <p className="m-0 text-[16px] leading-[20px]">Get Div to the hospital. Tap to hop the pints and sacks of snow. Big bald man? Tap twice to double jump.</p>
            <div className="anim-blink font-pix text-[10px]">TAP TO START</div>
          </Panel>
        )}
        {phase === 'crashed' && (
          <Panel>
            <div className="font-pix text-[12px] leading-[16px] text-yolk">{hit === 'baldy' ? 'STRAIGHT INTO BIG BALDY' : hit === 'sack' ? 'FACE FIRST IN THE SNOW' : 'ONE PINT TOO MANY'}</div>
            <p className="m-0 text-[16px] leading-[20px]">Div made it {Math.floor(progress * 100)}% of the way. Best: {best}%.</p>
            <button type="button" className="btn-big sm" onClick={restart}>TRY AGAIN ▶</button>
          </Panel>
        )}
        {phase === 'won' && (
          <Panel side>
            <div className="font-pix text-[12px] leading-[16px] text-yolk">HE MADE IT!</div>
            <p className="m-0 text-[16px] leading-[20px]">
              Baby Doyle has a dad on the scene. {wins > 1 ? `You've got him there ${wins} times.` : 'First time. Legend.'}
            </p>
            <button type="button" className="btn-big sm" onClick={restart}>RUN IT AGAIN ▶</button>
          </Panel>
        )}
      </div>

      <p className="m-0 max-w-[430px] text-center text-[14px] leading-[18px] text-[#D8D2C6]">
        Just for fun: Baby Dash doesn't count towards the crawl.
      </p>
    </div>,
    document.getElementById('overlay-root') ?? document.body,
  )
}

/** Message over the game. `side` puts it up in the sky without dimming, so the hospital finish stays in view. */
function Panel({ children, side = false }: { children: React.ReactNode; side?: boolean }) {
  return (
    <div className={`absolute inset-0 flex justify-center p-3 ${side ? 'items-start pt-[12%]' : 'items-center bg-ink/55'}`}>
      <div className="flex w-full max-w-[300px] flex-col items-center gap-2 border-4 border-ink bg-red px-3 py-3 text-center shadow-[4px_4px_0_var(--color-ink)]">
        {children}
      </div>
    </div>
  )
}

interface Art { head: HTMLImageElement; pints: HTMLImageElement[]; hospital: HTMLImageElement; wife: HTMLImageElement; baby: HTMLImageElement }

const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0

function draw(ctx: CanvasRenderingContext2D, w: World, art: Art, snow: { x: number; y: number; v: number; size: number }[], dt: number, phase: Phase) {
  // Sky and stars
  ctx.fillStyle = '#1B2440'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#3A4A78'
  for (let i = 0; i < 30; i++) ctx.fillRect((i * 71) % W, 20 + ((i * 29) % 120), 1, 1)

  // Skyline, with lit windows
  const cam = camera(w)
  const off = (cam * 0.3) % SKYLINE
  for (const b of BUILDINGS) {
    for (const shift of [0, SKYLINE]) {
      const x = Math.round(b.x - off + shift)
      if (x > W || x + b.w < 0) continue
      ctx.fillStyle = '#26335A'
      ctx.fillRect(x, GROUND - b.h, b.w, b.h)
      ctx.fillStyle = '#E8C547'
      for (let wy = GROUND - b.h + 6; wy < GROUND - 8; wy += 9) {
        for (let wx = x + 4; wx < x + b.w - 4; wx += 7) if (((wx * 7 + wy * 3) | 0) % 5 === 0) ctx.fillRect(wx, wy, 3, 4)
      }
    }
  }

  // Pavement
  ctx.fillStyle = '#F4F8FB'
  ctx.fillRect(0, GROUND, W, H - GROUND)
  ctx.fillStyle = '#9AAFC2'
  ctx.fillRect(0, GROUND, W, 2)
  const dash = Math.round(cam) % 24
  ctx.fillStyle = '#CFE0EE'
  for (let x = -dash; x < W; x += 24) ctx.fillRect(x, GROUND + 12, 12, 2)

  // The hospital, rolling in at the end of the track, with Joanna and Baby Doyle in the window
  const hx = Math.round(FINISH - cam + DIV_X)
  if (hx < W + 10 && ready(art.hospital)) {
    ctx.drawImage(art.hospital, hx, GROUND - 60, 104, 60)
    if (ready(art.wife)) ctx.drawImage(art.wife, hx + 22, GROUND - 24, 16, 16)
    if (ready(art.baby)) ctx.drawImage(art.baby, hx + 40, GROUND - 19, 12, 11)
  }

  // Pints (cropped to the glass) and sacks of snow
  for (const p of w.pints) {
    const px = Math.round(p.x - cam + DIV_X)
    if (isSack(p)) {
      drawSack(ctx, px, GROUND)
      continue
    }
    if (isBaldy(p)) {
      drawRows(ctx, BALDY, px, GROUND)
      continue
    }
    const i = art.pints[p.kind]
    if (ready(i)) ctx.drawImage(i, 16, 4, 32, 56, px, GROUND - 21, 12, 21)
  }

  // A puff of snow where the double jump kicked off
  if (w.puff && w.t - w.puff.t < 0.3) {
    const age = (w.t - w.puff.t) / 0.3
    const px = Math.round(w.puff.x - cam + DIV_X + 5)
    const py = Math.round(w.puff.y + 2)
    const r = Math.round(3 + age * 6)
    ctx.fillStyle = age < 0.5 ? '#FFFFFF' : '#CFE0EE'
    ctx.fillRect(px - r, py, 2, 2)
    ctx.fillRect(px + r, py, 2, 2)
    ctx.fillRect(px - Math.round(r / 2), py + 2, 2, 2)
    ctx.fillRect(px + Math.round(r / 2), py + 2, 2, 2)
  }

  // Div
  drawDiv(ctx, Math.round(DIV_X + w.dist - cam), Math.round(w.y), w.t, w.y < GROUND, phase === 'crashed', art.head)

  // Hearts once he's through the door
  if (phase === 'won') {
    ctx.fillStyle = '#E0457B'
    for (let i = 0; i < 5; i++) {
      const x = hx + 20 + i * 14
      const y = GROUND - 72 - ((i * 7 + Math.floor(performance.now() / 120)) % 14)
      ctx.fillRect(x, y, 2, 2)
      ctx.fillRect(x + 3, y, 2, 2)
      ctx.fillRect(x, y + 2, 5, 2)
      ctx.fillRect(x + 1, y + 4, 3, 1)
      ctx.fillRect(x + 2, y + 5, 1, 1)
    }
  }

  // Snow
  for (const f of snow) {
    f.y += f.v * dt
    // Wind-blown sideways, more so while Div is running into it
    f.x -= (phase === 'running' ? 34 : 10) * dt + Math.sin((f.y + f.v) / 14) * 0.15
    if (f.y > H) f.y = -2
    if (f.x < 0) f.x += W
    ctx.fillStyle = f.size > 1 ? '#FFFFFF' : '#E4EEF6'
    ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size)
  }

  // Progress: Div's head travelling towards the baby
  const pct = Math.min(1, w.dist / WIN_AT)
  ctx.fillStyle = INK
  ctx.fillRect(8, 6, W - 30, 7)
  ctx.fillStyle = '#C8102E'
  ctx.fillRect(9, 7, Math.round((W - 32) * pct), 5)
  if (ready(art.head)) ctx.drawImage(art.head, 4 + Math.round((W - 32) * pct), 3, 12, 12)
  if (ready(art.baby)) ctx.drawImage(art.baby, W - 19, 3, 13, 12)
}

/** Paint a little drawing (one character per pixel, '.' see-through) standing on the ground. */
const PALETTE: Record<string, string> = {
  K: INK, W: '#FFFFFF', S: '#E8B896', H: '#FBE3CF', h: '#C9906E', R: '#C8102E', r: '#8E0B21', J: JEANS, B: '#2B2B2B',
}
function drawRows(ctx: CanvasRenderingContext2D, rows: string[], x: number, ground: number) {
  const top = ground - rows.length
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const c = PALETTE[r[i]]
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x + i, top + j, 1, 1)
    }
  })
}

/** The big bald man: shiny head, arms folded, Christmas jumper. 15 wide, 47 tall: taller than one hop. */
const BALDY = [
  '....KKKKKK.....',
  '...KSSSSHHK....',
  '..KSSSSSSHHK...',
  '..KSSSSSSSHK...',
  '.KSSSSSSSSSSK..',
  '.KSKKSSSKKSSK..',
  '.KSSSSSSSSSSK..',
  '.KhSSSSSSSShK..',
  '.KSSSSShSSSSK..',
  '.KSSSSSSSSSSK..',
  '..KSSKKKKSSK...',
  '..KSSSSSSSSK...',
  '...KSSSSSSK....',
  '....KSSSSK.....',
  '..KKRRhhRRKK...',
  '.KRRRRRRRRRRK..',
  'KRRWRRRRRWRRRK.',
  'KRRRRRRRRRRRRK.',
  'KRRRRWRRRRRWRK.',
  'KRKKKKKKKKKKRK.',
  'KRKSSSSSSSSKRK.',
  'KRKSSSSSSSSKRK.',
  'KRRKKKKKKKKRRK.',
  'KRRRRRRWRRRRRK.',
  'KRRWRRRRRRWRRK.',
  'KRRRRRRRRRRRRK.',
  'KrrrrrrrrrrrrK.',
  '.KKKKKKKKKKKK..',
  '.KJJJJJJJJJJK..',
  '.KJJJJJJJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  '.KJJJJKKJJJJK..',
  'KBBBBBKKBBBBBK.',
  'KBBBBBKKBBBBBK.',
  'KKKKKKKKKKKKKK.',
]

/** A fat sack of snow, tied at the top, with a snowflake on the front. 17 wide, 16 tall, sitting on the ground. */
function drawSack(ctx: CanvasRenderingContext2D, x: number, ground: number) {
  const rows = [
    '......KKKKK......',
    '.......KbK.......',
    '......KWWWK......',
    '....KKWWWWWKK....',
    '...KWWWWWWWWWK...',
    '..KWWWWWsWWWWWK..',
    '.KWWWWsWsWsWWWWK.',
    '.KWWWWWsssWWWWWK.',
    'KWWWWssssssWWWWWK',
    'KWWWWWsssWWWWWWK.',
    'KWWWWsWsWsWWWWWWK',
    'KWWWWWWsWWWWWWWgK',
    'KWWWWWWWWWWWWWggK',
    '.KgWWWWWWWWWWggK.',
    '..KKgggggggggKK..',
    '....KKKKKKKKK....',
  ]
  const col: Record<string, string> = { K: INK, W: '#FFFFFF', g: '#CFE0EE', s: '#5B8BD9', b: '#7A4A23' }
  const top = ground - rows.length
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const c = col[r[i]]
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x + i, top + j, 1, 1)
    }
  })
}

/** Div running: his portrait for a head, white tee, jeans, legs pumping. */
function drawDiv(ctx: CanvasRenderingContext2D, x: number, feet: number, t: number, air: boolean, down: boolean, head: HTMLImageElement) {
  const stride = Math.floor(t * 12) % 2
  const top = feet - 31
  // legs
  ctx.fillStyle = INK
  if (air) {
    ctx.fillRect(x + 1, feet - 8, 4, 6)
    ctx.fillRect(x + 6, feet - 7, 4, 5)
  } else if (stride) {
    ctx.fillRect(x + 1, feet - 8, 4, 8)
    ctx.fillRect(x + 6, feet - 8, 4, 6)
  } else {
    ctx.fillRect(x + 1, feet - 8, 4, 6)
    ctx.fillRect(x + 6, feet - 8, 4, 8)
  }
  ctx.fillStyle = JEANS
  if (air) {
    ctx.fillRect(x + 2, feet - 8, 2, 5)
    ctx.fillRect(x + 7, feet - 7, 2, 4)
  } else {
    ctx.fillRect(x + 2, feet - 8, 2, stride ? 7 : 5)
    ctx.fillRect(x + 7, feet - 8, 2, stride ? 5 : 7)
  }
  // tee and arms
  ctx.fillStyle = INK
  ctx.fillRect(x, top + 15, 11, 9)
  ctx.fillStyle = TEE
  ctx.fillRect(x + 1, top + 16, 9, 7)
  ctx.fillStyle = SKIN
  ctx.fillRect(stride || air ? x + 10 : x - 2, top + 17, 2, 4)
  ctx.fillRect(stride || air ? x - 2 : x + 10, top + 19, 2, 3)
  // head
  if (head.complete && head.naturalWidth > 0) ctx.drawImage(head, x - 3, top, 17, 17)
  // spilled pint stars
  if (down) {
    ctx.fillStyle = '#FFE14D'
    ctx.fillRect(x - 4, top - 4, 2, 2)
    ctx.fillRect(x + 6, top - 7, 2, 2)
    ctx.fillRect(x + 14, top - 3, 2, 2)
  }
}
