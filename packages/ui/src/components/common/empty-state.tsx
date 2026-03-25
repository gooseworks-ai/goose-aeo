interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="#78716c"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-4 opacity-40"
      >
        <rect x="8" y="8" width="32" height="32" rx="4" />
        <path d="M16 20h16" />
        <path d="M16 28h8" />
      </svg>
      <h3 className="text-base font-medium text-[#78716c] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#78716c] opacity-70 text-center max-w-xs">{description}</p>
      )}
    </div>
  )
}
