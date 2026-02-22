import { useState } from 'react'
import { User, Mail, Phone, Building, MessageSquare, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import type { Customer } from '../../services/unified'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '../../utils/cn'

interface CustomerViewProps {
  customer?: Customer
}

// Mock customer for development
const mockCustomer: Customer = {
  id: '1',
  name: 'Max Mueller',
  email: 'mueller@firma.de',
  phone: '+49 123 456789',
  company: 'Mueller AG',
  hubspotId: 'hs-12345',
  weclappId: 'wc-67890',
  tasks: [
    {
      id: '1',
      title: 'Reklamation - Defektes Produkt',
      source: 'hubspot',
      type: 'ticket',
      priority: 'urgent',
      status: 'open',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  orders: [
    {
      id: '1',
      orderNumber: 'A-2024-0892',
      status: 'shipped',
      total: 1250.00,
      currency: 'EUR',
      items: 3,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      trackingNumber: 'DHL123456789',
    },
    {
      id: '2',
      orderNumber: 'A-2024-0756',
      status: 'delivered',
      total: 890.50,
      currency: 'EUR',
      items: 2,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      shippedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  interactions: [
    {
      id: '1',
      type: 'call',
      direction: 'inbound',
      subject: 'Frage zur Lieferung',
      summary: 'Kunde fragt nach Lieferstatus fuer Auftrag A-2024-0892',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'aircall',
    },
    {
      id: '2',
      type: 'email',
      direction: 'outbound',
      subject: 'Versandbestätigung A-2024-0892',
      summary: 'Versandbestaetigung mit Tracking-Link gesendet',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'weclapp',
    },
    {
      id: '3',
      type: 'ticket',
      direction: 'inbound',
      subject: 'Reklamation eingereicht',
      summary: 'Produkt bei Ankunft beschaedigt - Austausch angefordert',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'hubspot',
    },
  ],
}

const orderStatusConfig = {
  pending: { label: 'Ausstehend', variant: 'default' as const },
  confirmed: { label: 'Bestaetigt', variant: 'info' as const },
  shipped: { label: 'Versendet', variant: 'warning' as const },
  delivered: { label: 'Zugestellt', variant: 'success' as const },
  cancelled: { label: 'Storniert', variant: 'danger' as const },
}

const interactionTypeIcons = {
  email: Mail,
  call: Phone,
  note: MessageSquare,
  ticket: MessageSquare,
}

export function CustomerView({ customer = mockCustomer }: CustomerViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'interactions'>('overview')

  return (
    <div className="space-y-6">
      {/* Customer Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
              {customer.company && (
                <div className="mt-1 flex items-center gap-1 text-gray-500">
                  <Building className="h-4 w-4" />
                  <span>{customer.company}</span>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                    <Mail className="h-4 w-4" />
                    {customer.email}
                  </a>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                    <Phone className="h-4 w-4" />
                    {customer.phone}
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {customer.hubspotId && (
                <Badge variant="info">HubSpot</Badge>
              )}
              {customer.weclappId && (
                <Badge variant="success">Weclapp</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['overview', 'orders', 'interactions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'overview' ? 'Uebersicht' : tab === 'orders' ? 'Bestellungen' : 'Kommunikation'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Open Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Offene Aufgaben</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.tasks.filter(t => t.status !== 'completed').length === 0 ? (
                <p className="text-sm text-gray-500">Keine offenen Aufgaben</p>
              ) : (
                <ul className="space-y-3">
                  {customer.tasks.filter(t => t.status !== 'completed').map((task) => (
                    <li key={task.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={task.priority === 'urgent' ? 'danger' : 'warning'}>
                          {task.priority === 'urgent' ? 'Dringend' : 'Hoch'}
                        </Badge>
                        <span className="font-medium">{task.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: de })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Letzte Bestellungen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {customer.orders.slice(0, 3).map((order) => (
                  <li key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">{order.items} Artikel</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={orderStatusConfig[order.status].variant}>
                        {orderStatusConfig[order.status].label}
                      </Badge>
                      <p className="mt-1 font-medium">{order.total.toFixed(2)} {order.currency}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'orders' && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Bestellung</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Datum</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tracking</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{order.orderNumber}</span>
                      <br />
                      <span className="text-sm text-gray-500">{order.items} Artikel</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(order.createdAt), 'dd.MM.yyyy', { locale: de })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={orderStatusConfig[order.status].variant}>
                        {orderStatusConfig[order.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {order.trackingNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {order.total.toFixed(2)} {order.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'interactions' && (
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

              {/* Timeline items */}
              <ul className="space-y-6">
                {customer.interactions.map((interaction) => {
                  const Icon = interactionTypeIcons[interaction.type]
                  return (
                    <li key={interaction.id} className="relative pl-10">
                      {/* Icon */}
                      <div className={cn(
                        'absolute left-0 flex h-8 w-8 items-center justify-center rounded-full',
                        interaction.direction === 'inbound'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-green-100 text-green-600'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="rounded-lg border p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={interaction.source === 'hubspot' ? 'info' : interaction.source === 'weclapp' ? 'success' : 'default'}>
                                {interaction.source}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {interaction.direction === 'inbound' ? 'Eingehend' : 'Ausgehend'}
                              </span>
                            </div>
                            {interaction.subject && (
                              <h4 className="mt-1 font-medium">{interaction.subject}</h4>
                            )}
                            <p className="mt-1 text-sm text-gray-600">{interaction.summary}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-400">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(interaction.timestamp), { addSuffix: true, locale: de })}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
