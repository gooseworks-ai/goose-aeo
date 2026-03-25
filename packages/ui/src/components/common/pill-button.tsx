interface PillButtonProps {
  label: string
  active: boolean
  onClick: () => void
}

export function PillButton({ label, active, onClick }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer border ${
        active
          ? 'bg-[#1c1917] text-white border-transparent'
          : 'bg-white text-[#0c0a09] border-[#e7e5e4] hover:bg-[#f5f5f4]'
      }`}
    >
      {label}
    </button>
  )
}
