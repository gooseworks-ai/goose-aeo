import type { ReactNode } from 'react'

interface Column {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode
}

interface DataTableProps {
  columns: Column[]
  rows: Array<Record<string, unknown>>
  onRowClick?: (row: Record<string, unknown>) => void
}

export function DataTable({ columns, rows, onRowClick }: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#e7e5e4] overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-stone-200/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 h-9 text-xs font-medium uppercase tracking-wider text-[#78716c] bg-[#fafaf9] ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-stone-100/50 last:border-b-0 bg-white transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-stone-50/50' : ''
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 h-9 text-sm text-[#0c0a09] ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-[#78716c] bg-white"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
