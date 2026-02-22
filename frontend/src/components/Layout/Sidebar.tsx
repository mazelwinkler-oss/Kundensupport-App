import { Sun, ShoppingCart, Users, FileText, Zap, Settings, Mail } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
}

const menuItems = [
  { id: 'today',     label: 'Heute',       icon: Sun },
  { id: 'inbox',     label: 'Posteingang', icon: Mail },
  { id: 'orders',    label: 'Aufträge',    icon: ShoppingCart },
  { id: 'customers', label: 'Kunden',      icon: Users },
  { id: 'templates', label: 'Vorlagen',    icon: FileText },
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r bg-white flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Zap className="h-4.5 w-4.5" />
        </div>
        <div>
          <span className="block text-sm font-bold text-gray-900 leading-tight">Support-Zentrale</span>
          <span className="block text-xs text-gray-400">direktvomhersteller.de</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </button>
          )
        })}

        {/* Separator */}
        <div className="pt-2 mt-2 border-t">
          <button
            onClick={() => onNavigate('automations')}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              currentPage === 'automations'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Zap className="h-5 w-5 shrink-0" />
            Automatisierung
          </button>
        </div>
      </nav>

      {/* Footer: Settings */}
      <div className="border-t p-3">
        <button
          onClick={() => onNavigate('settings')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            currentPage === 'settings'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          Einstellungen
        </button>
      </div>
    </aside>
  )
}
