import { api } from './api'

export interface Task {
  id: string
  title: string
  description?: string
  source: 'hubspot' | 'weclapp' | 'aircall'
  type: 'lead' | 'ticket' | 'order' | 'call' | 'payment'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'open' | 'in_progress' | 'waiting' | 'completed'
  customerId?: string
  customerName?: string
  dueDate?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  hubspotId?: string
  weclappId?: string
  tasks: Task[]
  orders: Order[]
  interactions: Interaction[]
}

export interface Order {
  id: string
  orderNumber: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  total: number
  currency: string
  items: number
  createdAt: string
  shippedAt?: string
  trackingNumber?: string
}

export interface Interaction {
  id: string
  type: 'email' | 'call' | 'note' | 'ticket'
  direction: 'inbound' | 'outbound'
  subject?: string
  summary: string
  timestamp: string
  source: 'hubspot' | 'weclapp' | 'aircall'
}

export interface DashboardStats {
  newLeads: number
  openTickets: number
  pendingOrders: number
  missedCalls: number
  urgentTasks: Task[]
  automationSuggestions: AutomationSuggestion[]
}

export interface AutomationSuggestion {
  id: string
  title: string
  description: string
  potentialTimeSaved: string
  frequency: number
  workflowType: string
}

export interface AtRiskOrder {
  id: string
  orderNumber: string
  status: string
  statusCode: string
  createdDate: string
  daysOld: number
  riskLevel: 'high' | 'medium' | 'low'
  reason: string
  customer: {
    id: string
    name: string
    email: string
  }
  totalAmount: number
  currency: string
  itemCount: number
  requestedDeliveryDate?: string
}

export interface AtRiskOrdersResponse {
  count: number
  highRisk: number
  mediumRisk: number
  orders: AtRiskOrder[]
}

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await api.get('/dashboard/stats')
  return response.data
}

// Tasks
export async function getTasks(filters?: {
  source?: string
  priority?: string
  status?: string
}): Promise<Task[]> {
  const response = await api.get('/tasks', { params: filters })
  return response.data
}

export async function updateTaskStatus(taskId: string, status: Task['status']): Promise<Task> {
  const response = await api.patch(`/tasks/${taskId}`, { status })
  return response.data
}

// Customers
export async function getCustomers(search?: string): Promise<Customer[]> {
  const response = await api.get('/customers', { params: { search } })
  return response.data
}

export async function getCustomerById(customerId: string): Promise<Customer> {
  const response = await api.get(`/customers/${customerId}`)
  return response.data
}

// Templates
export interface Template {
  id: string
  name: string
  category: string
  subject?: string
  content: string
  placeholders: string[]
  taskTypes?: string[]
  keywords?: string[]
  usageCount: number
  createdAt?: string
  updatedAt?: string
}

export async function getTemplates(): Promise<Template[]> {
  const response = await api.get('/templates')
  return response.data
}

export async function applyTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<string> {
  const response = await api.post(`/templates/${templateId}/apply`, { variables })
  return response.data.content
}

// Weclapp Orders At Risk
export async function getOrdersAtRisk(): Promise<AtRiskOrdersResponse> {
  const response = await api.get('/weclapp/orders/at-risk')
  return response.data
}

// AI Suggestions
export interface TemplateSuggestion {
  template_id: string
  template_name: string
  category: string
  confidence: number
  filled_variables: Record<string, string>
  preview: string
}

export interface AISuggestionsResponse {
  suggestions: TemplateSuggestion[]
}

export async function getAISuggestions(params: {
  task_type: 'order' | 'complaint' | 'question' | 'delay' | 'payment' | 'ticket'
  customer_id?: string
  order_id?: string
}): Promise<AISuggestionsResponse> {
  const response = await api.post('/ai-suggestions', params)
  return response.data
}
