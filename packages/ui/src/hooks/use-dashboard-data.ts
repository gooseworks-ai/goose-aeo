import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import React from 'react'
import type {
  AEODataFetcher,
  CostsData,
  DashboardData,
  QueryRecord,
  RunRecord,
  StatusData,
} from '../types.js'

interface DashboardContextValue extends DashboardData {
  dataFetcher: AEODataFetcher
  refresh: () => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export interface DashboardDataProviderProps {
  dataFetcher: AEODataFetcher
  children: ReactNode
}

export function DashboardDataProvider({ dataFetcher, children }: DashboardDataProviderProps) {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [queries, setQueries] = useState<QueryRecord[]>([])
  const [costs, setCosts] = useState<CostsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [statusData, runsData, queriesData, costsData] = await Promise.all([
          dataFetcher<StatusData>('/api/status'),
          dataFetcher<RunRecord[]>('/api/runs?limit=50&offset=0'),
          dataFetcher<QueryRecord[]>('/api/queries'),
          dataFetcher<CostsData>('/api/costs?last=20'),
        ])

        if (!mounted) return

        setStatus(statusData)
        setRuns(runsData)
        setQueries(queriesData)
        setCosts(costsData)
      } catch (loadError) {
        if (!mounted) return
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [dataFetcher, refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  const value: DashboardContextValue = {
    status,
    runs,
    queries,
    costs,
    loading,
    error,
    dataFetcher,
    refresh,
  }

  return React.createElement(DashboardContext.Provider, { value }, children)
}

export function useDashboardData(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) {
    throw new Error('useDashboardData must be used within a DashboardDataProvider')
  }
  return ctx
}
