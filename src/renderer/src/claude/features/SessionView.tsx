import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageSquareOff, Send } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Session, ProcessedMessage } from '../types'
import type { ClaudeChatEvent } from '../chat/types'
import { SessionHeader } from './SessionHeader'
import { MessageList } from './MessageList'
import { TerminalPanel } from './terminal/TerminalPanel'

function nowId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

interface SessionViewProps {
  session: Session | null
  isLoading: boolean
  error: string | null
}

export function SessionView({ session, isLoading, error }: SessionViewProps): React.JSX.Element {
  const [showTerminal, setShowTerminal] = useState(false)
  const [messages, setMessages] = useState<ProcessedMessage[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Initialize messages from session
  useEffect(() => {
    if (session) {
      setMessages(session.messages)
      setChatId(null)
      chatIdRef.current = null
      setChatError(null)
    } else {
      setMessages([])
    }
  }, [session])

  // Sync ref with state
  useEffect(() => {
    chatIdRef.current = chatId
  }, [chatId])

  // Auto-scroll
  const lastMessageText = messages[messages.length - 1]?.textContent
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, lastMessageText])

  // Listen for chat events - run once on mount
  useEffect(() => {
    const unsubscribe = window.electron.onClaudeChatEvent((payload) => {
      // Use ref to check current chat ID without re-subscribing
      if (!chatIdRef.current || payload.chatId !== chatIdRef.current) return

      const event = payload.event as ClaudeChatEvent

      if (event.type === 'assistant_text_delta') {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last || last.role !== 'assistant' || !last.isStreaming) {
            next.push({
              uuid: nowId(),
              parentUuid: null,
              timestamp: new Date().toISOString(),
              role: 'assistant',
              textContent: event.delta,
              thinkingBlocks: [],
              toolUseBlocks: [],
              toolResults: {},
              isStreaming: true
            })
          } else {
            next[next.length - 1] = {
              ...last,
              textContent: last.textContent + event.delta
            }
          }
          return next
        })
      }

      if (event.type === 'assistant_text_done') {
        setSending(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.isStreaming) {
            next[next.length - 1] = { ...last, isStreaming: false }
          }
          return next
        })
      }

      if (event.type === 'error') {
        setSending(false)
        setChatError(event.message)
      }
    })

    return unsubscribe
  }, []) // Empty dependency array to run once

  // Cleanup chat on unmount or session change
  useEffect(() => {
    return () => {
      if (chatIdRef.current) {
        void window.electron.claudeChatClose({ chatId: chatIdRef.current })
      }
    }
  }, []) // Cleanup on unmount

  const onSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || sending || !session) return

    setChatError(null)
    setSending(true)
    setInput('')

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        uuid: nowId(),
        parentUuid: null,
        timestamp: new Date().toISOString(),
        role: 'user',
        textContent: text,
        thinkingBlocks: [],
        toolUseBlocks: [],
        toolResults: {}
      }
    ])

    try {
      let currentChatId = chatId
      if (!currentChatId) {
        const res = await window.electron.claudeChatCreate({
          model: 'claude-sonnet-4-5-20250929',
          resume: session.id
        })
        if (!res.success || !res.data?.chatId) {
          throw new Error(res.error || 'Failed to connect to session')
        }
        currentChatId = res.data.chatId
        setChatId(currentChatId)
        chatIdRef.current = currentChatId
      }

      const res = await window.electron.claudeChatSend({ chatId: currentChatId, input: text })
      if (!res.success) {
        throw new Error(res.error || 'Failed to send message')
      }
    } catch (err) {
      setSending(false)
      setChatError(err instanceof Error ? err.message : 'Failed to send')
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <MessageSquareOff className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-sm font-medium text-red-400">Failed to load session</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <MessageSquareOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No Session Selected</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Select a session from the sidebar to view its contents
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <SessionHeader
        session={session}
        showTerminal={showTerminal}
        onToggleTerminal={() => setShowTerminal(!showTerminal)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          ref={listRef}
          className={`flex-1 overflow-y-auto ${showTerminal ? 'h-1/2' : 'h-full'}`}
        >
          <MessageList messages={messages} subagents={session.subagents} />
          {chatError && (
            <div className="mx-4 mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {chatError}
            </div>
          )}
        </div>
        {showTerminal && (
          <div className="h-1/2 min-h-[200px]">
            <TerminalPanel
              cwd={session.cwd}
              sessionId={session.id}
              onClose={() => setShowTerminal(false)}
            />
          </div>
        )}
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
            placeholder="Message..."
            disabled={sending}
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
            disabled={sending || !input.trim()}
            className={cn(
              'inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
            )}
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
