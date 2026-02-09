import { useState, useCallback, useEffect, useRef } from 'react'
import type { Terminal as XTerm } from 'xterm'

interface UseTerminalOptions {
  onData?: (data: string) => void
  onExit?: (exitCode: number, signal?: number) => void
}

export function useTerminal(options: UseTerminalOptions = {}) {
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const xtermRef = useRef<XTerm | null>(null)

  useEffect(() => {
    const unsubData = (window.electron as any).onTerminalData((id: string, data: string) => {
      if (id === terminalId && xtermRef.current) {
        xtermRef.current.write(data)
        options.onData?.(data)
      }
    })

    const unsubExit = (window.electron as any).onTerminalExit(
      (id: string, exitCode: number, signal?: number) => {
        if (id === terminalId) {
          setIsRunning(false)
          options.onExit?.(exitCode, signal)
        }
      }
    )

    return () => {
      unsubData()
      unsubExit()
    }
  }, [terminalId, options])

  const spawn = useCallback(async (spawnOptions?: { cwd?: string; sessionId?: string }) => {
    try {
      setError(null)
      const response = await (window.electron as any).terminalSpawn(spawnOptions)
      if (response.success && response.data) {
        setTerminalId(response.data)
        setIsRunning(true)
        return response.data as string
      } else {
        setError(response.error || 'Failed to spawn terminal')
        return null
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spawn terminal')
      return null
    }
  }, [])

  const write = useCallback(
    (data: string) => {
      if (terminalId) {
        ;(window.electron as any).terminalWrite(terminalId, data)
      }
    },
    [terminalId]
  )

  const resize = useCallback(
    (cols: number, rows: number) => {
      if (terminalId) {
        ;(window.electron as any).terminalResize(terminalId, cols, rows)
      }
    },
    [terminalId]
  )

  const kill = useCallback(async () => {
    if (terminalId) {
      await (window.electron as any).terminalKill(terminalId)
      setTerminalId(null)
      setIsRunning(false)
    }
  }, [terminalId])

  const setXterm = useCallback((xterm: XTerm | null) => {
    xtermRef.current = xterm
  }, [])

  return {
    terminalId,
    isRunning,
    error,
    spawn,
    write,
    resize,
    kill,
    setXterm
  }
}
