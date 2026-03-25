import type { ReactNode } from 'react'
import { Sidebar } from './sidebar.js'
import { TopBar } from './top-bar.js'
import type { PageId } from '../../types.js'
import type { TimeRange } from '../../hooks/use-time-range.js'

interface PageLayoutProps {
  activePage: PageId
  onNavigate: (page: PageId, filters?: Record<string, unknown>) => void
  companyName: string
  pageName: string
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  children: ReactNode
}

export function PageLayout({
  activePage,
  onNavigate,
  companyName,
  pageName,
  timeRange,
  onTimeRangeChange,
  children,
}: PageLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#f2f1f0]">
      <Sidebar activePage={activePage} onNavigate={onNavigate} companyName={companyName} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar
          pageName={pageName}
          companyName={companyName}
          timeRange={timeRange}
          onTimeRangeChange={onTimeRangeChange}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
