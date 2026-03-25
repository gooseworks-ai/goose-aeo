interface LoadingSkeletonProps {
  rows?: number
}

export function LoadingSkeleton({ rows = 4 }: LoadingSkeletonProps) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-10 rounded-md bg-stone-200/50 animate-pulse"
          style={{ width: `${100 - i * 8}%` }}
        />
      ))}
    </div>
  )
}
