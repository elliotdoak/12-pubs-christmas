import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand, Footer, Knit, Logo, Screen } from '../components/ui'
import {
  canPromptInstall, detectOS, isStandalone, locationState, notificationState, onInstallAvailable,
  promptInstall, requestLocation, requestNotifications, type PermState,
} from '../lib/platform'
import { load, save } from '../lib/storage'

type Ill = 'browser' | 'share' | 'sheet' | 'menu' | 'menu2' | 'home' | 'bell' | 'pin' | 'battery' | 'done'
interface Step { t: string; p: string; ill: Ill; act?: 'notif' | 'loc' }

// Part 1 runs in the browser and ends at "open it from your home screen".
const INSTALL: Record<'ios' | 'android', Step[]> = {
  ios: [
    { t: 'OPEN IN SAFARI', p: 'Got the link in WhatsApp? Tap ••• then Open in Safari. The game only installs from Safari.', ill: 'browser' },
    { t: 'TAP SHARE', p: "Tap the Share button in Safari's toolbar. On newer iPhones it sits under the ••• button.", ill: 'share' },
    { t: 'ADD TO HOME SCREEN', p: 'Scroll down the list, tap Add to Home Screen, then tap Add.', ill: 'sheet' },
    { t: 'OPEN IT FROM YOUR HOME SCREEN', p: "Close Safari. Find the 12 Pubs icon and open the game from there. That's what makes alerts work.", ill: 'home' },
  ],
  android: [
    { t: 'OPEN IN CHROME', p: 'Got the link in WhatsApp? Tap ⋮ then Open in Chrome.', ill: 'browser' },
    { t: 'TAP THE ⋮ MENU', p: 'Tap the three dots in the top-right corner of Chrome.', ill: 'menu' },
    { t: 'TAP INSTALL APP', p: 'Tap Install app (or Add to Home screen, then Install).', ill: 'menu2' },
    { t: 'OPEN IT FROM YOUR HOME SCREEN', p: 'Find the 12 Pubs icon and open the game from there.', ill: 'home' },
  ],
}

// Part 2 runs inside the installed app.
const SETUP: Record<'ios' | 'android', Step[]> = {
  ios: [
    { t: 'TURN ON ALERTS', p: 'Alerts tell you when the crew has moved on and when to drink up. No alerts, no game.', ill: 'bell', act: 'notif' },
    { t: 'ALLOW LOCATION', p: "Pick Allow While Using App. Every time the game opens, it checks you in to the pub you're at.", ill: 'pin', act: 'loc' },
  ],
  android: [
    { t: 'TURN ON ALERTS', p: 'Alerts tell you when the crew has moved on and when to drink up. No alerts, no game.', ill: 'bell', act: 'notif' },
    { t: 'ALLOW LOCATION', p: "Pick While using the app. Every time the game opens, it checks you in to the pub you're at.", ill: 'pin', act: 'loc' },
    { t: 'STOP BATTERY SAVER', p: 'Settings → Apps → Chrome → Battery → Unrestricted. Otherwise your phone may hold back alerts.', ill: 'battery' },
  ],
}

const DONE: Step = {
  t: 'NOW PICK YOUR PLAYER',
  p: 'Installed and ready. Last step: tell the game who you are, then it counts down to Saturday 28 November.',
  ill: 'done',
}

export default function Install() {
  const nav = useNavigate()
  const detected = detectOS()
  const [os, setOs] = useState<'ios' | 'android'>(detected === 'android' ? 'android' : 'ios')
  const [inApp, setInApp] = useState(() => isStandalone() || load('browserMode', false))
  const [i, setI] = useState(0)
  const [notif, setNotif] = useState<PermState>(notificationState())
  const [loc, setLoc] = useState<PermState>('prompt')
  const [installable, setInstallable] = useState(canPromptInstall())

  useEffect(() => {
    locationState().then(setLoc)
  }, [])
  useEffect(() => onInstallAvailable(() => setInstallable(true)), [])

  const steps = inApp ? [...SETUP[os], DONE] : INSTALL[os]
  const s = steps[Math.min(i, steps.length - 1)]
  const isLast = i === steps.length - 1
  const total = inApp ? steps.length - 1 : steps.length
  const actState = s.act === 'notif' ? notif : s.act === 'loc' ? loc : null
  const actDone = actState === 'granted'

  const next = () => {
    if (inApp && isLast) {
      save('setupDone', true)
      nav('/', { replace: true })
      return
    }
    setI((n) => Math.min(n + 1, steps.length - 1))
  }

  const doAct = async () => {
    if (s.act === 'notif') setNotif(await requestNotifications())
    if (s.act === 'loc') setLoc(await requestLocation())
  }

  const continueInBrowser = () => {
    save('browserMode', true)
    setInApp(true)
    setI(0)
  }

  return (
    <Screen>
      <Knit />
      <div className="flex flex-col gap-3 px-[18px] pb-3 pt-4">
        <Brand />
        <h1 className="m-0 font-pix text-[22px] leading-[28px] text-yolk [text-shadow:3px_3px_0_var(--color-ink)]">
          {inApp ? (
            <>SET UP<br />THE GAME</>
          ) : (
            <>INSTALL<br />THE GAME</>
          )}
        </h1>
        <div className="flex" role="tablist" aria-label="Phone type">
          {(['ios', 'android'] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={os === o}
              onClick={() => { setOs(o); setI(0) }}
              className={`border-4 border-ink px-3 py-2 font-pix text-[9px] ${os === o ? 'bg-ink text-yolk' : 'bg-wool text-ink'}`}
            >
              {o === 'ios' ? 'IPHONE' : 'ANDROID'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-[14px] pb-4">
        <div className="flex items-center gap-3">
          <span className="shrink-0 font-pix text-[9px] text-white">
            {s.ill === 'done' ? 'COMPLETE!' : `LEVEL ${i + 1} OF ${total}`}
          </span>
          <span className="h-3 flex-1 border-2 border-ink bg-red-dark" aria-hidden="true">
            <i className="block h-full bg-yolk transition-[width]" style={{ width: `${Math.round((i / total) * 100)}%` }} />
          </span>
        </div>

        <div key={`${os}${inApp}${i}`} className="panel anim-pop flex flex-col gap-3 p-4">
          <div className="flex h-[150px] items-center justify-center">
            <Illustration kind={s.ill} />
          </div>
          <h2 className="m-0 font-pix text-[13px] leading-[18px]">{s.t}</h2>
          <p className="m-0 text-[17px] leading-[22px]">{s.p}</p>

          {s.act && (
            actDone ? (
              <span className="tag self-start bg-pine text-white">{s.act === 'notif' ? 'ALERTS ON' : 'LOCATION ON'}</span>
            ) : actState === 'denied' ? (
              <p className="m-0 text-[15px] leading-[20px] text-red">
                {s.act === 'notif'
                  ? 'Alerts are blocked. Turn them on in Settings → Notifications → 12 Pubs.'
                  : 'Location is blocked. Turn it on in Settings → Privacy → Location Services → 12 Pubs.'}
              </p>
            ) : actState === 'unsupported' ? (
              <p className="m-0 text-[15px] leading-[20px] text-muted">
                {s.act === 'notif' && os === 'ios'
                  ? 'Alerts only work once the game is opened from your home screen, on iOS 16.4 or later.'
                  : "This browser can't do that. Carry on and the Game Master will cover you."}
              </p>
            ) : (
              <button type="button" className="btn-big sm self-start" onClick={doAct}>
                {s.act === 'notif' ? 'TURN ON ALERTS' : 'ALLOW LOCATION'}
              </button>
            )
          )}

          {!inApp && i === 0 && os === 'android' && installable && (
            <button type="button" className="btn-big sm self-start" onClick={async () => { if (await promptInstall()) setI(3) }}>
              INSTALL NOW
            </button>
          )}
        </div>
      </div>

      <Footer>
        {!inApp && isLast ? (
          <>
            <p className="m-0 text-center font-pix text-[10px] leading-[16px] text-yolk">SEE YOU ON THE HOME SCREEN</p>
            <button type="button" className="btn-text" onClick={continueInBrowser}>
              CAN'T INSTALL? CARRY ON IN THE BROWSER
            </button>
          </>
        ) : (
          <button type="button" className="btn-big" onClick={next}>
            {inApp && isLast ? 'PRESS START ▶' : s.act && !actDone ? 'SKIP FOR NOW ▶' : 'NEXT ▶'}
          </button>
        )}
        <button
          type="button"
          className="btn-text"
          style={{ visibility: i > 0 ? 'visible' : 'hidden' }}
          onClick={() => setI((n) => Math.max(0, n - 1))}
        >
          ◀ BACK
        </button>
      </Footer>
    </Screen>
  )
}

/* ---------- little pixel phone illustrations ---------- */

function Mini({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative flex h-[146px] w-[180px] flex-col overflow-hidden rounded-[14px] border-4 border-ink bg-white ${className}`}>
      {children}
    </div>
  )
}

function Url({ dots = false }: { dots?: boolean }) {
  return (
    <div className="m-2 flex items-center gap-1 rounded-md bg-[#EEE] px-2 py-1 text-[11px] text-muted">
      <i className="block h-2 w-2 bg-muted" />
      <span className="flex-1 truncate">12pubs.elliot-doak.workers.dev</span>
      {dots && <span className="bg-yolk px-1 font-bold text-ink outline-2 outline-ink">⋮</span>}
    </div>
  )
}

function Bar({ hl }: { hl?: number }) {
  return (
    <div className="mt-auto flex justify-around border-t-2 border-[#DDD] bg-[#F6F6F6] py-2">
      {[0, 1, 2, 3, 4].map((n) => (
        <i key={n} className={`block h-3 w-3 border-2 ${n === hl ? 'anim-blink border-ink bg-yolk' : 'border-[#2F7DF6]'}`} />
      ))}
    </div>
  )
}

function Sheet({ items, hl, top = false }: { items: string[]; hl: number; top?: boolean }) {
  return (
    <div className={`m-2 flex flex-col gap-1 ${top ? '' : 'mt-auto'}`}>
      {items.map((t, n) => (
        <span key={t} className={`rounded px-2 py-1 text-[12px] ${n === hl ? 'border-2 border-ink bg-yolk font-bold text-ink' : 'bg-[#F0F0F0] text-muted'}`}>
          {t}
        </span>
      ))}
    </div>
  )
}

function Illustration({ kind }: { kind: Ill }) {
  switch (kind) {
    case 'browser':
      return (
        <Mini>
          <Url />
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-red">
            <Logo size={24} />
            <b className="font-pix text-[6px] text-yolk">12 PUBS OF CHRISTMAS</b>
          </div>
          <Bar />
        </Mini>
      )
    case 'share':
      return (
        <Mini>
          <Url />
          <div className="flex-1 bg-red/40" />
          <Bar hl={2} />
        </Mini>
      )
    case 'sheet':
      return (
        <Mini className="bg-[#E9E9EE]">
          <Sheet items={['Copy', 'Add to Reading List', 'Add to Home Screen ⊞', 'Find on Page']} hl={2} />
        </Mini>
      )
    case 'menu':
      return (
        <Mini>
          <Url dots />
          <div className="flex-1 bg-red/40" />
        </Mini>
      )
    case 'menu2':
      return (
        <Mini className="bg-[#E9E9EE]">
          <Sheet top items={['New tab', 'Bookmarks', 'Install app ⊞', 'Settings']} hl={2} />
        </Mini>
      )
    case 'home':
      return (
        <Mini className="bg-gradient-to-b from-[#5B8BD9] to-[#9C7BD9]">
          <div className="grid grid-cols-4 gap-2 p-3">
            {['#5B8BD9', '#7FD08F', '#F4A63A', '#9C7BD9', '#E06A8A', '#4FB6C9', '#C9C2B5'].map((c) => (
              <span key={c} className="block aspect-square rounded-md border-2 border-white/40" style={{ background: c }} />
            ))}
            <span className="anim-bob flex aspect-square items-center justify-center rounded-md border-2 border-ink bg-red">
              <Logo size={20} />
            </span>
          </div>
          <div className="mr-3 self-end text-[11px] font-bold text-white">12 Pubs</div>
        </Mini>
      )
    case 'bell':
      return <img src="/sprites/ui/bell.svg" alt="" width={90} height={81} className="pixel anim-bob" />
    case 'pin':
      return <img src="/sprites/ui/pin.svg" alt="" width={84} height={98} className="pixel anim-bob" />
    case 'battery':
      return <img src="/sprites/ui/battery.svg" alt="" width={64} height={64} className="pixel" />
    default:
      return <Logo size={96} />
  }
}
