import { Home, ListTodo, Users, FileText, BarChart3, Settings, Zap, CalendarCheck } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'daily-plan', label: 'Tagesplan', icon: CalendarCheck },
  { id: 'tasks', label: 'Aufgaben', icon: ListTodo },
  { id: 'customers', label: 'Kunden', icon: Users },
  { id: 'templates', label: 'Vorlagen', icon: FileText },
  { id: 'analytics', label: 'Analyse', icon: BarChart3 },
  { id: 'automations', label: 'Automatisierung', icon: Zap },
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Zap className="h-5 w-5" />
        </div>
        <span className="font-semibold text-gray-900">Support-Zentrale</span>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t p-4">
        <button
          onClick={() => onNavigate('settings')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <Settings className="h-5 w-5" />
          Einstellungen
        </button>
      </div>
    </aside>
  )
}
