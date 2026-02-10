import { useState, type ReactNode } from 'react'
import { LayoutContext } from './layout-context'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  return (
    <LayoutContext.Provider value={{ sidebarCollapsed, setSidebarCollapsed }}>
      <div className="flex h-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-hidden bg-background">{children}</main>
      </div>
    </LayoutContext.Provider>
  )
}
