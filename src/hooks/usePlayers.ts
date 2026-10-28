import { useCallback, useEffect, useState } from 'react'
import { fetchPlayers, type PlayerRow } from '../lib/api'

/** Players with their joined flag. Polls so the lobby fills up as people join. */
export function usePlayers(pollMs = 0) {
  const [players, setPlayers] = useState<PlayerRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setPlayers(await fetchPlayers())
      setError(null)
    } catch {
      setError('Could not load the players. Check your signal.')
    }
  }, [])

  useEffect(() => {
    reload()
    if (!pollMs) return
    const id = setInterval(reload, pollMs)
    return () => clearInterval(id)
  }, [reload, pollMs])

  return { players, error, reload }
}
