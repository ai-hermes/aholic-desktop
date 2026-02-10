import { createContext, useContext } from 'react'

export interface LayoutContextType {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const LayoutContext = createContext<LayoutContextType | null>(null)

export function useLayout(): LayoutContextType {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a Layout')
  }
  return context
}
