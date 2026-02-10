import { useEffect, useCallback, useRef } from 'react'
import type { Terminal as XTerm } from 'xterm'
import { Terminal } from './Terminal'
import { useTerminal } from './useTerminal'

interface TerminalPanelProps {
  cwd?: string
  sessionId?: string
  onClose: () => void
}

export function TerminalPanel({ cwd, sessionId, onClose }: TerminalPanelProps): React.JSX.Element {
  const { isRunning, error, spawn, write, resize, kill, setXterm } = useTerminal({
    onExit: () => {
      // keep panel open; user can close manually
    }
  })

  // Use refs to avoid the infinite loop: spawn → terminalId changes → kill ref
  // changes → useEffect re-runs → kill() then spawn() → repeat forever
  const spawnRef = useRef(spawn)
  const killRef = useRef(kill)

  useEffect(() => {
    spawnRef.current = spawn
    killRef.current = kill
  })

  useEffect(() => {
    spawnRef.current({ cwd, sessionId })
    return () => {
      killRef.current()
    }
  }, [cwd, sessionId])

  const handleTerminalReady = useCallback(
    (xterm: XTerm) => {
      setXterm(xterm)
    },
    [setXterm]
  )

  const handleTerminalData = useCallback(
    (data: string) => {
      write(data)
    },
    [write]
  )

  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      resize(cols, rows)
    },
    [resize]
  )

  const handleClose = useCallback(() => {
    kill()
    onClose()
  }, [kill, onClose])

  return (
    <div className="flex h-full flex-col border-t border-zinc-800/50 bg-[#0a0a0a]">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/50 bg-[#0f0f0f] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-zinc-500" />
          <span className="text-xs font-medium text-zinc-400">Terminal</span>
          {isRunning && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Running" />
          )}
        </div>
        <button
          onClick={handleClose}
          className="h-5 w-5 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded flex items-center justify-center text-[10px]"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        ) : (
          <Terminal
            onReady={handleTerminalReady}
            onData={handleTerminalData}
            onResize={handleTerminalResize}
          />
        )}
      </div>
    </div>
  )
}
