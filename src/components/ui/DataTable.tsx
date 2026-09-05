import { useMemo, useState, type ReactNode } from 'react'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  align?: 'left' | 'right'
  render?: (row: T) => ReactNode
  accessor?: (row: T) => string | number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  emptyAction?: { label: string; onClick: () => void }
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'No records in this ledger.',
  emptyAction,
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
    return <EmptyState message={emptyMessage} action={emptyAction} />
  }

  return (
    <div className="w-full">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-bronze/40">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => onHeader(col)}
                className={`h-8 pr-4 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted ${col.sortable ? 'cursor-pointer select-none' : ''} ${col.align === 'right' ? 'text-right' : ''} ${col.className ?? ''}`}
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
              className={`border-b border-ink/[0.08] transition-colors duration-150 last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-surfaceAlt/70' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`h-9 pr-4 text-[13px] text-ink ${col.align === 'right' ? 'text-right font-serif text-[15px] tabular-nums' : ''} ${col.className ?? ''}`}
                >
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
