import { useEffect, useState } from 'react'
import { gameNow } from '../data/crawl'

export function useCountdown(target: string) {
  const end = new Date(target).getTime()
  const [now, setNow] = useState(() => gameNow())

  useEffect(() => {
    const id = setInterval(() => setNow(gameNow()), 1000)
    return () => clearInterval(id)
  }, [])

  const ms = Math.max(0, end - now)
  return {
    done: ms === 0,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  }
}
