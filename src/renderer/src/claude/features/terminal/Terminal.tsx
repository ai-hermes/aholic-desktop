import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

interface TerminalProps {
  onReady?: (xterm: XTerm) => void
  onData?: (data: string) => void
  onResize?: (cols: number, rows: number) => void
}

export function Terminal({ onReady, onData, onResize }: TerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const isInitializedRef = useRef(false)

  const safeFit = useCallback(() => {
    if (!fitAddonRef.current || !xtermRef.current || !containerRef.current) return

    const { offsetWidth, offsetHeight } = containerRef.current
    if (offsetWidth === 0 || offsetHeight === 0) return

    try {
      // Guard against internal renderer not being ready yet.
      const maybeCore = (
        xtermRef.current as unknown as { _core?: { _renderService?: { dimensions?: unknown } } }
      )._core
      const hasDimensions = !!maybeCore?._renderService?.dimensions
      if (!hasDimensions) return

      fitAddonRef.current.fit()
      const { cols, rows } = xtermRef.current
      onResize?.(cols, rows)
    } catch (e) {
      console.warn('Terminal fit error:', e)
    }
  }, [onResize])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let disposed = false
    let initRaf1 = 0
    let initRaf2 = 0
    let waitObserver: ResizeObserver | null = null
    let resizeObserver: ResizeObserver | null = null
    let dataDisposable: { dispose: () => void } | null = null

    const waitForNonZeroSize = (el: HTMLElement, timeoutMs = 2000): Promise<boolean> => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) return Promise.resolve(true)
      return new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => {
          waitObserver?.disconnect()
          waitObserver = null
          resolve(false)
        }, timeoutMs)

        waitObserver = new ResizeObserver(() => {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            window.clearTimeout(timeout)
            waitObserver?.disconnect()
            waitObserver = null
            resolve(true)
          }
        })
        waitObserver.observe(el)
      })
    }

    const init = async (): Promise<void> => {
      // Delay initialization so StrictMode's mount->unmount probe does not
      // create an xterm instance that schedules work after dispose.
      await new Promise<void>((resolve) => {
        initRaf1 = window.requestAnimationFrame(() => resolve())
      })
      if (disposed) return

      await waitForNonZeroSize(container)
      if (disposed) return

      const xterm = new XTerm({
        cols: 80,
        rows: 24,
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#0a0a0a',
          foreground: '#f0f0f0',
          cursor: '#f0f0f0',
          cursorAccent: '#0a0a0a',
          selectionBackground: '#3a3a3a',
          black: '#000000',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#6272a4',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#f8f8f2',
          brightBlack: '#6272a4',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#d6acff',
          brightMagenta: '#ff92df',
          brightCyan: '#a4ffff',
          brightWhite: '#ffffff'
        },
        allowProposedApi: true,
        scrollback: 1000
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()
      xterm.loadAddon(fitAddon)
      xterm.loadAddon(webLinksAddon)

      xtermRef.current = xterm
      fitAddonRef.current = fitAddon

      xterm.open(container)

      dataDisposable = xterm.onData((data) => {
        onData?.(data)
      })

      await new Promise<void>((resolve) => {
        initRaf2 = window.requestAnimationFrame(() => resolve())
      })
      if (disposed) return

      isInitializedRef.current = true
      safeFit()
      onReady?.(xterm)

      resizeObserver = new ResizeObserver(() => {
        if (disposed || !isInitializedRef.current) return
        safeFit()
      })
      resizeObserver.observe(container)
    }

    void init()

    return () => {
      disposed = true
      isInitializedRef.current = false
      window.cancelAnimationFrame(initRaf1)
      window.cancelAnimationFrame(initRaf2)
      waitObserver?.disconnect()
      resizeObserver?.disconnect()
      dataDisposable?.dispose()
      dataDisposable = null
      try {
        xtermRef.current?.dispose()
      } finally {
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }
  }, [onReady, onData, safeFit])

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#0a0a0a] p-1"
      style={{ minHeight: '200px' }}
    />
  )
}
