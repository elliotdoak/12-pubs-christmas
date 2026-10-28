import { supabase } from './supabase'
import type { CostumeKey, PlayerId } from '../data/crawl'

export interface PlayerRow {
  id: PlayerId
  name: string
  costume: CostumeKey
  has_pin: boolean
}

export type ClaimError = 'no_session' | 'bad_format' | 'locked' | 'no_player' | 'wrong_pin' | 'gm_pin_not_set' | 'not_gm' | 'network'

export interface ClaimResult {
  ok: boolean
  error?: ClaimError
  new_pin?: boolean
}

function need() {
  if (!supabase) throw new Error('Supabase is not configured. Add your keys to .env.local')
  return supabase
}

export async function fetchPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await need().from('players').select('id,name,costume,has_pin').order('name')
  if (error) throw error
  return data as PlayerRow[]
}

async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<ClaimResult> {
  const { data, error } = await need().rpc(fn, args)
  if (error) return { ok: false, error: 'network' }
  return (data ?? { ok: true }) as ClaimResult
}

export const claimPlayer = (player: PlayerId, pin: string) => rpc('claim_player', { p_player: player, p_pin: pin })
export const releasePlayer = () => rpc('release_player')
export const claimGm = (pin: string) => rpc('claim_gm', { p_pin: pin })
export const releaseGm = () => rpc('release_gm')
export const gmResetPin = (player: PlayerId) => rpc('gm_reset_pin', { p_player: player })

export const CLAIM_MESSAGES: Record<ClaimError, string> = {
  no_session: 'No connection to the game. Check your signal and try again.',
  bad_format: 'PINs are 4 digits.',
  locked: 'Too many wrong PINs. Locked for 10 minutes. Ask the Game Master if you are stuck.',
  no_player: "That player doesn't exist.",
  wrong_pin: 'Wrong PIN. Try again.',
  gm_pin_not_set: 'The Game Master PIN has not been set up yet.',
  not_gm: 'Game Master only.',
  network: 'Could not reach the game. Check your signal and try again.',
}
