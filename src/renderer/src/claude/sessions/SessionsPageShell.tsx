// Thin shell that will later host the full sessions UI.
// For now we just prove wiring and data loading from Electron.

import { useEffect, useState } from 'react'
import type { ProjectGroup, Session } from '../types'
import { SessionView } from '../features/SessionView'
import { ChatPanel } from '../chat/ChatPanel'
import { Plus, Settings } from 'lucide-react'
import { SettingsDialog } from '../../components/SettingsDialog'

export function SessionsPageShell(): React.JSX.Element {
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [selected, setSelected] = useState<{ id: string; projectEncoded: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const res = await window.electron.sessionsGetAll()
        if (!cancelled) {
          if (res.success && res.data) {
            setGroups(res.data as ProjectGroup[])
            setError(null)
          } else {
            setError(res.error || 'Failed to load sessions')
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    let cancelled = false

    async function loadSession(): Promise<void> {
      try {
        const current = selected
        if (!current) return
        const res = await window.electron.sessionsGet(current.id, current.projectEncoded)
        if (!cancelled) {
          if (res.success && res.data) {
            setCurrentSession(res.data as Session)
          } else {
            setCurrentSession(null)
            setError(res.error || 'Failed to load session')
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCurrentSession(null)
          setError(err instanceof Error ? err.message : 'Failed to load session')
        }
      }
    }

    loadSession()
    return () => {
      cancelled = true
    }
  }, [selected])

  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    window.electron.getAppVersion().then((res) => {
      if (res.success && res.data) {
        setAppVersion(res.data)
      }
    })
  }, [])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading Claude sessions...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">Failed to load sessions: {error}</div>
  }

  if (!groups.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No Claude Code sessions found in ~/.claude/projects
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex w-80 shrink-0 flex-col border-r border-border bg-muted/10 text-xs">
        <div className="flex-1 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.project} className="mb-3">
              <div className="mt-1 space-y-1">
                {group.sessions.map((s) => (
                  <button
                    key={s.id}
                    className={`w-full rounded border border-border bg-card p-2 text-left hover:bg-accent ${
                      selected?.id === s.id ? 'ring-1 ring-ring' : ''
                    }`}
                    onClick={() => setSelected({ id: s.id, projectEncoded: group.projectEncoded })}
                  >
                    <div className="line-clamp-2 text-[11px] text-foreground">{s.firstMessage}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {s.messageCount} messages
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              v{appVersion}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="rounded-md p-2 hover:bg-accent hover:text-accent-foreground"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-2 hover:bg-accent hover:text-accent-foreground"
                title="New Chat"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <SessionView
            session={currentSession}
            isLoading={!!selected && !currentSession}
            error={error}
          />
        ) : (
          <ChatPanel />
        )}
      </div>

      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}
