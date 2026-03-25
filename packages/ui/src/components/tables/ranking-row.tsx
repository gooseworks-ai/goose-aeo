interface RankingRowProps {
  rank: number
  domain: string
  name: string
  value: number
  delta?: number
  onClick?: () => void
}

export function RankingRow({ rank, domain, name, value, delta, onClick }: RankingRowProps) {
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 border-b border-stone-100/50 last:border-b-0 bg-white hover:bg-stone-50/50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className="w-8 text-sm font-medium text-[#78716c] text-center shrink-0">
        {rank}
      </span>

      <img
        src={faviconUrl}
        alt=""
        width={20}
        height={20}
        className="rounded shrink-0"
        loading="lazy"
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#0c0a09] truncate">{name}</div>
        <div className="text-xs text-[#78716c] truncate">{domain}</div>
      </div>

      <span className="text-sm font-semibold text-[#0c0a09] shrink-0">
        {(value * 100).toFixed(1)}%
      </span>

      {delta !== undefined && delta !== 0 && (
        <span
          className={`text-xs font-medium shrink-0 ${
            delta > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'
          }`}
        >
          {delta > 0 ? '\u2191' : '\u2193'} {Math.abs(delta * 100).toFixed(1)}%
        </span>
      )}
    </div>
  )
}
