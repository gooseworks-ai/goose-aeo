import type { ReactNode } from 'react'
import type { PageId } from '../../types.js'

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId, filters?: Record<string, unknown>) => void
  companyName: string
}

interface NavItem {
  id: PageId
  label: string
  icon: ReactNode
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10L10 3l7 7" />
      <path d="M5 8v8a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8" />
    </svg>
  )
}

function ModelsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 10h14" />
      <path d="M10 3v14" />
    </svg>
  )
}

function QueriesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="5" />
      <path d="M14 14l3 3" />
    </svg>
  )
}

function CitationsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h12" />
      <path d="M4 9h8" />
      <path d="M4 13h10" />
      <path d="M4 17h6" />
    </svg>
  )
}

function CompetitorsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16V8" />
      <path d="M8 16V4" />
      <path d="M12 16V10" />
      <path d="M16 16V6" />
    </svg>
  )
}

function ResponsesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h12a1 1 0 011 1v8a1 1 0 01-1 1H8l-4 3v-3a1 1 0 01-1-1V5a1 1 0 011-1z" />
    </svg>
  )
}

function RunsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v12" />
      <path d="M6 4l5 4-5 4" />
      <path d="M14 4v12" />
    </svg>
  )
}

function RecommendationsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2a5 5 0 015 5c0 2.76-2.24 4-3 5.5V14H8v-1.5C7.24 11 5 9.76 5 7a5 5 0 015-5z" />
      <path d="M8 16h4" />
      <path d="M9 18h2" />
    </svg>
  )
}

function AuditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M8 8l2 2 3-3" />
      <path d="M7 13h6" />
    </svg>
  )
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Home', icon: <HomeIcon /> },
  { id: 'models', label: 'Models', icon: <ModelsIcon /> },
  { id: 'queries', label: 'Queries', icon: <QueriesIcon /> },
  { id: 'responses', label: 'Responses', icon: <ResponsesIcon /> },
  { id: 'citations', label: 'Citations', icon: <CitationsIcon /> },
  { id: 'competitors', label: 'Competitors', icon: <CompetitorsIcon /> },
  { id: 'runs', label: 'Runs', icon: <RunsIcon /> },
  { id: 'recommendations', label: 'Recommendations', icon: <RecommendationsIcon /> },
  { id: 'audit', label: 'Audit', icon: <AuditIcon /> },
]

export function Sidebar({ activePage, onNavigate, companyName }: SidebarProps) {
  return (
    <aside className="flex flex-col w-64 min-h-screen shrink-0 bg-[#f2f1f0] border-r border-[#e7e5e4]">
      <div className="flex items-center gap-3 px-5 py-6">
        <img src="https://gooseworks.ai/images/goose-avatars/goose15.png" alt="Goose" className="w-7 h-7 rounded-md" />
        <span className="text-sm font-semibold tracking-wide uppercase text-[#78716c]">
          {companyName}
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0 w-full text-left ${
                isActive
                  ? 'bg-stone-200/75 text-[#0c0a09]'
                  : 'bg-transparent text-[#78716c] hover:bg-stone-200/50 hover:text-[#0c0a09]'
              }`}
            >
              <span className="flex items-center shrink-0">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
