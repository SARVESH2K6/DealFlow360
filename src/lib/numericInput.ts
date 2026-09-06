import type { KeyboardEvent } from 'react'

const BLOCKED = new Set(['-', '+', 'e', 'E'])

export function blockNegativeKey(e: KeyboardEvent<HTMLInputElement>): void {
  if (BLOCKED.has(e.key)) e.preventDefault()
}

export function sanitizeNonNegative(raw: string): string {
  return raw.replace(/[eE+\-]/g, '')
}
