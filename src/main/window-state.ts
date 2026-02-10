import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

type PersistedWindowState = {
  width: number
  height: number
  isMaximized: boolean
}

const STATE_FILENAME = 'window-state.json'

function getStatePath(): string {
  return join(app.getPath('userData'), STATE_FILENAME)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function coerceState(value: unknown): PersistedWindowState | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const width = record['width']
  const height = record['height']
  const isMaximized = record['isMaximized']

  if (!isFiniteNumber(width) || !isFiniteNumber(height)) return null
  if (width < 300 || width > 5000) return null
  if (height < 300 || height > 5000) return null
  if (typeof isMaximized !== 'boolean') return null

  return { width, height, isMaximized }
}

export async function loadWindowState(): Promise<PersistedWindowState | null> {
  try {
    const raw = await readFile(getStatePath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return coerceState(parsed)
  } catch {
    return null
  }
}

export async function saveWindowState(window: BrowserWindow): Promise<void> {
  try {
    if (window.isDestroyed()) return

    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds()
    const state: PersistedWindowState = {
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized()
    }

    await writeFile(getStatePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // Best-effort persistence: ignore failures (e.g. filesystem permissions).
  }
}
