import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { PlayerId } from '../data/crawl'

const BUCKET = 'photos'
const FULL_PX = 1280
const THUMB_PX = 420
const SIGN_FOR = 60 * 60 * 24 // seconds

/** Max photos one person can post at one pub (or before the crawl). The database enforces it too. */
export const PHOTO_LIMIT = 3

export const thumbPath = (path: string) => path.replace(/\.jpg$/, '_t.jpg')

/** Shrink a phone photo to a sensible JPEG. Keeps the night's data use (and upload time on 4G) low. */
async function resize(file: Blob, max: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality))
}

export interface NewPhoto {
  file: File
  playerId: PlayerId
  pub: number | null
  caption: string
  tagged: PlayerId[]
}

export type UploadError = 'unreadable' | 'upload' | 'save' | 'limit'

export async function uploadPhoto(p: NewPhoto): Promise<{ ok: true } | { ok: false; error: UploadError }> {
  if (!supabase) return { ok: false, error: 'upload' }
  let full: Blob, thumb: Blob
  try {
    full = await resize(p.file, FULL_PX, 0.82)
    thumb = await resize(p.file, THUMB_PX, 0.75)
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  const id = crypto.randomUUID()
  const path = `${p.playerId}/${id}.jpg`
  const store = supabase.storage.from(BUCKET)
  const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }
  const [a, b] = await Promise.all([store.upload(path, full, opts), store.upload(thumbPath(path), thumb, opts)])
  if (a.error || b.error) {
    await store.remove([path, thumbPath(path)])
    return { ok: false, error: 'upload' }
  }
  const { error } = await supabase.from('photos').insert({
    id, player_id: p.playerId, pub_n: p.pub, path, caption: p.caption.trim() || null, tagged: p.tagged,
  })
  if (error) {
    await store.remove([path, thumbPath(path)])
    return { ok: false, error: /photo_limit/.test(error.message) ? 'limit' : 'save' }
  }
  return { ok: true }
}

export async function deletePhoto(id: string, path: string) {
  if (!supabase) return false
  const { error } = await supabase.from('photos').delete().eq('id', id)
  if (error) return false
  await supabase.storage.from(BUCKET).remove([path, thumbPath(path)])
  return true
}

export const UPLOAD_MESSAGES: Record<UploadError, string> = {
  unreadable: "Couldn't read that photo. Try another, or take a new one.",
  upload: 'Upload failed. Check your signal and try again.',
  save: 'Uploaded, but it didn’t save to the wall. Try again.',
  limit: `You've already posted ${PHOTO_LIMIT} photos here. Delete one to post another.`,
}

/* ---------- signed links, cached for the session ---------- */

const cache = new Map<string, { url: string; exp: number }>()

/** Signed URLs for a set of storage paths (private bucket). Batches requests and caches them. */
export function useSignedUrls(paths: string[]) {
  const key = paths.join('|')
  const [, bump] = useState(0)

  useEffect(() => {
    if (!supabase || !paths.length) return
    const now = Date.now()
    const missing = paths.filter((p) => {
      const c = cache.get(p)
      return !c || c.exp < now + 60_000
    })
    if (!missing.length) return
    let live = true
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, SIGN_FOR)
      .then(({ data }) => {
        for (const d of data ?? []) if (d.signedUrl && d.path) cache.set(d.path, { url: d.signedUrl, exp: Date.now() + SIGN_FOR * 1000 })
        if (live) bump((n) => n + 1)
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (path: string) => cache.get(path)?.url
}
