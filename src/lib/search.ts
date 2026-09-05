export function matchesSearch(query: string, parts: Array<string | number | undefined | null>): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return parts.some((part) => String(part ?? '').toLowerCase().includes(q))
}
