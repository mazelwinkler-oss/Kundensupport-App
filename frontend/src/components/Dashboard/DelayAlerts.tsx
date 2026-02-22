import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, Package, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { getOrdersAtRisk, type AtRiskOrder } from '../../services/unified'

interface DelayAlertsProps {
  onOrderClick?: (order: AtRiskOrder) => void
}

export function DelayAlerts({ onOrderClick }: DelayAlertsProps) {
  const [orders, setOrders] = useState<AtRiskOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ highRisk: 0, mediumRisk: 0 })

  useEffect(() => {
    loadOrders()
    // Refresh every 5 minutes
    const interval = setInterval(loadOrders, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadOrders = async () => {
    try {
      const data = await getOrdersAtRisk()
      setOrders(data.orders)
      setStats({ highRisk: data.highRisk, mediumRisk: data.mediumRisk })
      setError(null)
    } catch (err) {
      console.error('Failed to load at-risk orders:', err)
      setError('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  const getRiskBadge = (riskLevel: 'high' | 'medium' | 'low') => {
    switch (riskLevel) {
      case 'high':
        return <Badge variant="danger">Kritisch</Badge>
      case 'medium':
        return <Badge variant="warning">Warnung</Badge>
      default:
        return <Badge>Normal</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Verzoegerungsrisiko
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Verzoegerungsrisiko
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={loadOrders}
            className="text-blue-500 text-sm underline mt-2"
          >
            Erneut versuchen
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Verzoegerungsrisiko
          </CardTitle>
          <div className="flex gap-2 text-sm">
            {stats.highRisk > 0 && (
              <span className="text-red-600 font-medium">{stats.highRisk} kritisch</span>
            )}
            {stats.mediumRisk > 0 && (
              <span className="text-yellow-600 font-medium">{stats.mediumRisk} Warnung</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Keine Auftraege mit Verzoegerungsrisiko</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onOrderClick?.(order)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {order.orderNumber}
                    </span>
                    {getRiskBadge(order.riskLevel)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {order.customer.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{order.reason}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-medium text-gray-900">
                    {order.totalAmount?.toFixed(2)} {order.currency}
                  </p>
                  <p className="text-xs text-gray-500">
                    {order.status}
                  </p>
                </div>
              </div>
            ))}

            {orders.length > 5 && (
              <button className="w-full text-center text-sm text-blue-600 hover:underline py-2">
                +{orders.length - 5} weitere Auftraege anzeigen
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
