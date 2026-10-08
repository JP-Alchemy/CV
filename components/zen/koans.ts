'use client'

/**
 * The three hidden koans. Finding all of them quietly earns a second,
 * smaller seal beside the name at the summit — the wanderer's seal.
 * No toasts, no confetti. Those who notice, notice.
 */

export const KOAN_IDS = ['gate', 'moon', 'lantern'] as const
export type KoanId = (typeof KOAN_IDS)[number]

const STORE_KEY = 'zen-koans'
const EVENT = 'zen-koan-found'

export function readKoans(): KoanId[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return KOAN_IDS.filter((id) => parsed.includes(id))
  } catch {
    return []
  }
}

export function markKoan(id: KoanId) {
  try {
    const found = readKoans()
    if (found.includes(id)) return
    localStorage.setItem(STORE_KEY, JSON.stringify([...found, id]))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* private mode — the koan was still read, and that is enough */
  }
}

export function allKoansFound(): boolean {
  return readKoans().length === KOAN_IDS.length
}

export function onKoanFound(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
