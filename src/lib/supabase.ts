import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null until .env.local is filled in, so the app still runs offline during early builds. */
export const supabase = url && key ? createClient(url, key) : null
