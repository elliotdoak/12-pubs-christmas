import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/session'
import { GameProvider } from './lib/game'
import { DrunkProvider } from './lib/drunk'
import { Announcement } from './components/Announcement'
import { isGameDay } from './data/crawl'
import { load } from './lib/storage'
import { Logo, Screen } from './components/ui'
import Install from './screens/Install'
import Who from './screens/Who'
import Pin from './screens/Pin'
import Lobby from './screens/Lobby'
import Gm from './screens/Gm'
import MapScreen from './screens/MapScreen'
import Scores from './screens/Scores'
import Photos from './screens/Photos'

export default function App() {
  return (
    <SessionProvider>
      <GameProvider>
      <BrowserRouter>
        <DrunkProvider>
        <Routes>
          <Route path="/" element={<Gate />} />
          <Route path="/install" element={<Install />} />
          <Route path="/who" element={<Ready><Who /></Ready>} />
          <Route path="/pin/:id" element={<Ready><Pin /></Ready>} />
          <Route path="/lobby" element={<Ready needPlayer><Lobby /></Ready>} />
          <Route path="/map" element={<Ready needPlayer><MapScreen /></Ready>} />
          <Route path="/scores" element={<Ready needPlayer><Scores /></Ready>} />
          <Route path="/photos" element={<Ready needPlayer><Photos /></Ready>} />
          <Route path="/gm" element={<Ready><Gm /></Ready>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </DrunkProvider>
        <Announcement />
      </BrowserRouter>
      </GameProvider>
    </SessionProvider>
  )
}

/** Sends each phone to the right place: install → pick player → lobby. */
function Gate() {
  const { ready, error, playerId } = useSession()
  if (!ready) return <Splash />
  if (error) return <Splash message={error} />
  if (!load('setupDone', false)) return <Navigate to="/install" replace />
  if (!playerId) return <Navigate to="/who" replace />
  return <Navigate to={isGameDay() ? '/map' : '/lobby'} replace />
}

/** Waits for the session; optionally requires a claimed player. */
function Ready({ children, needPlayer = false }: { children: ReactNode; needPlayer?: boolean }) {
  const { ready, error, playerId } = useSession()
  if (!ready) return <Splash />
  if (error) return <Splash message={error} />
  if (needPlayer && !playerId) return <Navigate to="/who" replace />
  return <>{children}</>
}

function Splash({ message }: { message?: string }) {
  return (
    <Screen className="items-center justify-center gap-6 px-8 text-center">
      <Logo size={72} />
      <p className="m-0 font-pix text-[11px] leading-[18px] text-yolk" role={message ? 'alert' : 'status'}>
        {message ?? <span className="anim-blink">LOADING…</span>}
      </p>
    </Screen>
  )
}
