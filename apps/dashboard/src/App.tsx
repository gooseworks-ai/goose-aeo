import { AEODashboard } from '@goose-aeo/ui'

const dataFetcher = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export function App() {
  return <AEODashboard dataFetcher={dataFetcher} companyName="Goose AEO" />
}
