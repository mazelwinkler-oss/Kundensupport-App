import { useState, useEffect, useCallback } from 'react'
import {
  Mail, RefreshCw, Loader2, AlertCircle, CheckCircle2,
  ExternalLink, User, ChevronRight, Settings
} from 'lucide-react'
import { api } from '../../services/api'
import { cn } from '../../utils/cn'

interface InboxEmail {
  id: string
  subject: string
  from: { name?: string; address: string }
  receivedAt: string
  preview: string
  body: string
  isRead: boolean
  customerId?: string
  customerName?: string
  source: string
}

interface InboxResponse {
  configured: boolean
  message?: string
  emails: InboxEmail[]
  total: number
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `vor ${mins} Min.`
  if (hours < 24) return `vor ${hours} Std.`
  if (days === 1) return 'gestern'
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function Inbox() {
  const [data, setData] = useState<InboxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InboxEmail | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/email/inbox')
      setData(res.data)
    } catch {
      setData({ configured: false, message: 'Verbindungsfehler', emails: [], total: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Not configured state
  if (!loading && data && !data.configured) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-blue-100 p-2.5">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Posteingang</h1>
            <p className="text-sm text-gray-500">mail@direktvomhersteller.de</p>
          </div>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800">Microsoft Graph nicht verbunden</p>
              <p className="text-sm text-orange-700 mt-1">
                Um den echten Posteingang zu sehen, trage diese 4 Werte in <code className="bg-orange-100 px-1 rounded">backend/.env</code> ein:
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white border border-orange-200 p-4 font-mono text-sm space-y-1">
            <p className="text-gray-500"># backend/.env</p>
            <p><span className="text-blue-600">MICROSOFT_TENANT_ID</span>=<span className="text-green-600">deine-tenant-id</span></p>
            <p><span className="text-blue-600">MICROSOFT_CLIENT_ID</span>=<span className="text-green-600">deine-app-id</span></p>
            <p><span className="text-blue-600">MICROSOFT_CLIENT_SECRET</span>=<span className="text-green-600">dein-secret</span></p>
            <p><span className="text-blue-600">MICROSOFT_SENDER_EMAIL</span>=<span className="text-green-600">mail@direktvomhersteller.de</span></p>
          </div>

          <div className="space-y-2 text-sm text-orange-800">
            <p className="font-semibold">So bekommst du die Werte (5 Minuten):</p>
            <ol className="list-decimal list-inside space-y-1 text-orange-700">
              <li>Gehe zu <strong>portal.azure.com</strong> → „App-Registrierungen" → „Neue Registrierung"</li>
              <li>Name: „Kundensupport App" → Registrieren</li>
              <li><strong>MICROSOFT_CLIENT_ID</strong> = Anwendungs-ID (auf der Übersichtsseite)</li>
              <li><strong>MICROSOFT_TENANT_ID</strong> = Verzeichnis-ID (auf der Übersichtsseite)</li>
              <li>„Zertifikate &amp; Geheimnisse" → „Neuer geheimer Clientschlüssel" → Wert kopieren = <strong>MICROSOFT_CLIENT_SECRET</strong></li>
              <li>„API-Berechtigungen" → „Berechtigung hinzufügen" → Microsoft Graph → Anwendungsberechtigungen:<br />
                <code className="bg-orange-100 px-1 rounded">Mail.Read</code>, <code className="bg-orange-100 px-1 rounded">Mail.Send</code>, <code className="bg-orange-100 px-1 rounded">Mail.ReadWrite</code><br />
                → „Administratorzustimmung erteilen" klicken
              </li>
            </ol>
          </div>

          <a
            href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 w-fit"
          >
            <Settings className="h-4 w-4" />
            Azure Portal öffnen
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    )
  }

  const emails = data?.emails || []
  const unread = emails.filter(e => !e.isRead).length

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-0 -m-6 overflow-hidden">
      {/* Email list */}
      <div className="w-80 shrink-0 border-r bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm">Posteingang</span>
            {unread > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">{unread}</span>
            )}
          </div>
          <button onClick={load} className="rounded p-1.5 hover:bg-gray-100" title="Aktualisieren">
            <RefreshCw className={cn('h-3.5 w-3.5 text-gray-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}
          {!loading && emails.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-400 mb-2" />
              <p className="text-sm text-gray-500">Posteingang leer</p>
            </div>
          )}
          {emails.map(email => (
            <button
              key={email.id}
              onClick={() => setSelected(email)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                selected?.id === email.id && 'bg-blue-50',
                !email.isRead && 'border-l-2 border-l-blue-600'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <span className={cn('text-sm truncate', !email.isRead ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                  {email.from?.name || email.from?.address || 'Unbekannt'}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(email.receivedAt)}</span>
              </div>
              <p className={cn('text-xs truncate mb-0.5', !email.isRead ? 'font-medium text-gray-800' : 'text-gray-600')}>
                {email.subject || '(kein Betreff)'}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400 truncate flex-1">{email.preview}</p>
                {email.customerName && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 shrink-0">
                    <User className="h-2.5 w-2.5" />
                    {email.customerName.split(' ')[0]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Email detail */}
      <div className="flex-1 bg-white overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">E-Mail auswählen zum Lesen</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4 max-w-3xl">
            {/* Subject */}
            <h2 className="text-xl font-bold text-gray-900">{selected.subject || '(kein Betreff)'}</h2>

            {/* Meta */}
            <div className="flex items-start gap-4 text-sm text-gray-600 border-b pb-4">
              <div className="flex-1 space-y-1">
                <p><span className="text-gray-400">Von:</span> {selected.from?.name ? `${selected.from.name} <${selected.from.address}>` : selected.from?.address}</p>
                <p><span className="text-gray-400">Empfangen:</span> {new Date(selected.receivedAt).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                {selected.customerName && (
                  <p className="flex items-center gap-1.5">
                    <span className="text-gray-400">Kunde:</span>
                    <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      <User className="h-3 w-3" />
                      {selected.customerName}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                  </p>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {/* Strip HTML tags if body contains HTML */}
              {selected.body?.includes('<') && selected.body?.includes('>')
                ? <div dangerouslySetInnerHTML={{ __html: selected.body }} />
                : selected.body || selected.preview
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
