import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { ChatMessage, ClaudeChatEvent } from './types'

function nowId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ChatPanel(): React.JSX.Element {
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      const res = await window.electron.claudeChatCreate({
        model: 'claude-sonnet-4-5-20250929'
      })
      if (cancelled) return
      if (!res.success || !res.data?.chatId) {
        setError(res.error || 'Failed to create chat')
        return
      }
      setChatId(res.data.chatId)
    }

    init().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to init chat')
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!chatId) return
    const unsubscribe = window.electron.onClaudeChatEvent((payload) => {
      if (payload.chatId !== chatId) return
      const event = payload.event as ClaudeChatEvent

      if (event.type === 'assistant_text_delta') {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last || last.role !== 'assistant') {
            next.push({ id: nowId(), role: 'assistant', text: event.delta, createdAt: Date.now() })
          } else {
            next[next.length - 1] = { ...last, text: last.text + event.delta }
          }
          return next
        })
      }

      if (event.type === 'assistant_text_done') {
        setSending(false)
      }

      if (event.type === 'error') {
        setSending(false)
        setError(event.message)
      }
    })

    return unsubscribe
  }, [chatId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  useEffect(() => {
    return () => {
      if (chatId) {
        void window.electron.claudeChatClose({ chatId })
      }
    }
  }, [chatId])

  const onSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || !chatId || sending) return

    setError(null)
    setSending(true)
    setInput('')
    setMessages((prev) => [...prev, { id: nowId(), role: 'user', text, createdAt: Date.now() }])

    const res = await window.electron.claudeChatSend({ chatId, input: text })
    if (!res.success) {
      setSending(false)
      setError(res.error || 'Failed to send')
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-medium text-foreground">Chat</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Powered by Claude Agent SDK (requires `ANTHROPIC_API_KEY` in environment)
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {!messages.length && (
          <div className="mx-auto mt-12 max-w-md text-center text-sm text-muted-foreground">
            Ask anything. The conversation context is kept in the session.
          </div>
        )}

        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[720px] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'mr-auto bg-secondary text-secondary-foreground'
              )}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void onSend()
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            placeholder={chatId ? 'Message Claude...' : 'Initializing...'}
            disabled={!chatId || sending}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void onSend()
              }
            }}
          />
          <button
            type="submit"
            disabled={!chatId || sending || !input.trim()}
            className={cn(
              'inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
            )}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
