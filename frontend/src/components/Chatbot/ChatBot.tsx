import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react'
import { api } from '../../services/api'
import { cn } from '../../utils/cn'

interface Message {
  id: string
  role: 'user' | 'bot'
  text: string
  timestamp: Date
  confidence?: number
}

const QUICK_QUESTIONS = [
  'Wie lange dauert die Lieferung?',
  'Welche Whirlpool-Modelle gibt es?',
  'Gibt es Outdoor-Whirlpools?',
  'Was kostet ein Whirlpool?',
]

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'bot',
        text: 'Hallo! Ich bin dein SpaVida®-Assistent. Ich beantworte Fragen zu Whirlpools, Lieferzeiten und Produkten. Was möchtest du wissen?',
        timestamp: new Date(),
      }])
    }
  }, [isOpen, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/chatbot', { question: text })
      const data = res.data
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: data.answer || 'Dazu habe ich leider keine Informationen.',
        timestamp: new Date(),
        confidence: data.confidence,
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'bot',
        text: 'Verbindungsfehler – bitte versuche es erneut.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all',
          isOpen ? 'bg-gray-700 hover:bg-gray-800' : 'bg-blue-600 hover:bg-blue-700'
        )}
        title="Produkt-Assistent"
      >
        {isOpen
          ? <X className="h-6 w-6 text-white" />
          : <MessageCircle className="h-6 w-6 text-white" />
        }
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
          style={{ maxHeight: '70vh' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-blue-600 px-4 py-3">
            <div className="rounded-full bg-white/20 p-1.5">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">SpaVida® Assistent</p>
              <p className="text-xs text-blue-200">Produktwissen & Infos</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="ml-auto rounded p-1 hover:bg-white/20">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 200 }}>
            {messages.map(msg => (
              <div key={msg.id} className={cn('flex gap-2 items-end', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'rounded-full p-1.5 shrink-0',
                  msg.role === 'bot' ? 'bg-blue-100' : 'bg-gray-100'
                )}>
                  {msg.role === 'bot'
                    ? <Bot className="h-3.5 w-3.5 text-blue-600" />
                    : <User className="h-3.5 w-3.5 text-gray-600" />
                  }
                </div>
                <div className={cn(
                  'rounded-xl px-3 py-2 text-sm max-w-[85%]',
                  msg.role === 'bot'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-blue-600 text-white'
                )}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.confidence !== undefined && msg.confidence < 0.5 && (
                    <p className="text-xs text-gray-400 mt-1">Niedrige Konfidenz – bitte verifizieren</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-end">
                <div className="rounded-full bg-blue-100 p-1.5">
                  <Bot className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-3 py-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Frage stellen..."
              disabled={loading}
              className="flex-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
