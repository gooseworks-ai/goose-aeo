import { useState, useCallback } from 'react'
import type { AEODashboardProps, PageId, ResponseFilters } from './types.js'
import { DashboardDataProvider } from './hooks/use-dashboard-data.js'
import { PageLayout } from './components/layout/page-layout.js'
import { useTimeRange } from './hooks/use-time-range.js'
import { OverviewPage } from './pages/overview-page.js'
import { ModelPage } from './pages/model-page.js'
import { QueryPage } from './pages/query-page.js'
import { ResponsesPage } from './pages/responses-page.js'
import { CitationPage } from './pages/citation-page.js'
import { CompetitorsPage } from './pages/competitors-page.js'
import { RunsPage } from './pages/runs-page.js'
import { RecommendationsPage } from './pages/recommendations-page.js'
import { AuditPage } from './pages/audit-page.js'

const pageNames: Record<PageId, string> = {
  overview: 'Overview',
  models: 'Models',
  queries: 'Queries',
  responses: 'Responses',
  citations: 'Citations',
  competitors: 'Competitors',
  runs: 'Runs',
  recommendations: 'Recommendations',
  audit: 'Audit',
}

export function AEODashboard({ dataFetcher, companyName }: AEODashboardProps) {
  const [activePage, setActivePage] = useState<PageId>('overview')
  const [responseFilters, setResponseFilters] = useState<ResponseFilters | undefined>()
  const { range: timeRange, setRange: setTimeRange } = useTimeRange()

  const handleNavigate = useCallback((page: PageId, filters?: ResponseFilters) => {
    setActivePage(page)
    if (page === 'responses' && filters) {
      setResponseFilters(filters)
    } else {
      setResponseFilters(undefined)
    }
  }, [])

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <OverviewPage onNavigate={handleNavigate} />
      case 'models':
        return <ModelPage onNavigate={handleNavigate} />
      case 'queries':
        return <QueryPage onNavigate={handleNavigate} />
      case 'responses':
        return <ResponsesPage initialFilters={responseFilters} onNavigate={handleNavigate} />
      case 'citations':
        return <CitationPage onNavigate={handleNavigate} />
      case 'competitors':
        return <CompetitorsPage onNavigate={handleNavigate} />
      case 'runs':
        return <RunsPage />
      case 'recommendations':
        return <RecommendationsPage />
      case 'audit':
        return <AuditPage />
      default:
        return <OverviewPage onNavigate={handleNavigate} />
    }
  }

  return (
    <DashboardDataProvider dataFetcher={dataFetcher}>
      <PageLayout
        activePage={activePage}
        onNavigate={handleNavigate}
        companyName={companyName ?? 'Goose AEO'}
        pageName={pageNames[activePage]}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      >
        {renderPage()}
      </PageLayout>
    </DashboardDataProvider>
  )
}

export type { AEODashboardProps } from './types.js'
