import * as os from 'node:os'
import * as fs from 'node:fs'
import { BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { v4 as uuidv4 } from 'uuid'

export interface TerminalOptions {
  cwd?: string
  sessionId?: string
  resume?: boolean
  fork?: boolean
}

interface TerminalInstance {
  id: string
  pty: pty.IPty
  cwd: string
  sessionId?: string
}

const terminals = new Map<string, TerminalInstance>()

function resolveShell(): string {
  if (os.platform() === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }

  const candidates: string[] = []

  if (process.env.SHELL) {
    candidates.push(process.env.SHELL)
  }

  // Common shells on macOS / Linux
  candidates.push('/bin/zsh', '/bin/bash', '/bin/sh')

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return candidate
      }
    } catch {
      // ignore
    }
  }

  // Fallback; may still fail, but we've tried our best
  return '/bin/sh'
}

export function spawn(window: BrowserWindow, options: TerminalOptions = {}): string {
  const id = uuidv4()
  let cwd = options.cwd || os.homedir()
  const shell = resolveShell()

  // Validate cwd exists, fallback to home directory if not
  try {
    if (!fs.existsSync(cwd)) {
      console.warn(`Terminal cwd does not exist: ${cwd}, falling back to home directory`)
      cwd = os.homedir()
    }
  } catch {
    console.warn(`Failed to check cwd: ${cwd}, falling back to home directory`)
    cwd = os.homedir()
  }

  const args: string[] = []

  // In future we can add `claude --resume` here if desired
  if (options.sessionId && options.resume) {
    // Placeholder: currently just open an interactive shell in the session's cwd
  }

  let ptyProcess: pty.IPty
  try {
    ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Failed to spawn terminal with shell ${shell} in cwd ${cwd}: ${errorMessage}`)
    throw new Error(`Failed to spawn terminal: ${errorMessage}. Shell: ${shell}, CWD: ${cwd}`)
  }

  terminals.set(id, {
    id,
    pty: ptyProcess,
    cwd,
    sessionId: options.sessionId
  })

  ptyProcess.onData((data) => {
    if (!window.isDestroyed()) {
      window.webContents.send('terminal:data', { id, data })
    }
  })

  ptyProcess.onExit(({ exitCode, signal }) => {
    if (!window.isDestroyed()) {
      window.webContents.send('terminal:exit', { id, exitCode, signal })
    }
    terminals.delete(id)
  })

  return id
}

export function write(id: string, data: string): boolean {
  const terminal = terminals.get(id)
  if (!terminal) return false
  terminal.pty.write(data)
  return true
}

export function resize(id: string, cols: number, rows: number): boolean {
  const terminal = terminals.get(id)
  if (!terminal) return false
  terminal.pty.resize(cols, rows)
  return true
}

export function kill(id: string): boolean {
  const terminal = terminals.get(id)
  if (!terminal) return false
  terminal.pty.kill()
  terminals.delete(id)
  return true
}

export function killAll(): void {
  for (const [id, terminal] of terminals) {
    terminal.pty.kill()
    terminals.delete(id)
  }
}

export function getActiveTerminals(): string[] {
  return Array.from(terminals.keys())
}

export function exists(id: string): boolean {
  return terminals.has(id)
}
