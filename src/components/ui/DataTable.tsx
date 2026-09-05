import { useMemo, useState, type ReactNode } from 'react'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (row: T) => ReactNode
  accessor?: (row: T) => string | number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'No records',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find((c) => c.key === sortKey)
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = col?.accessor ? col.accessor(a) : String((a as Record<string, unknown>)[sortKey] ?? '')
      const bv = col?.accessor ? col.accessor(b) : String((b as Record<string, unknown>)[sortKey] ?? '')
      if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av
      return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return copy
  }, [rows, sortKey, dir, columns])

  function onHeader(col: Column<T>) {
    if (!col.sortable) return
    if (sortKey === col.key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col.key)
      setDir('asc')
    }
  }

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="h-9 bg-surfaceAlt">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => onHeader(col)}
                className={`px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted ${col.sortable ? 'cursor-pointer select-none' : ''} ${col.className ?? ''}`}
              >
                {col.header}
                {sortKey === col.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`h-11 border-b border-border last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-surfaceAlt' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 text-[14px] text-ink ${col.className ?? ''}`}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
