import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, getStoredTheme, type ResolvedTheme, type Theme } from './theme-context'

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light')
  const [isInitialized, setIsInitialized] = useState(false)

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect((): (() => void) => {
    window.electron
      .getNativeTheme()
      .then((response) => {
        if (response.success && response.data) {
          setSystemTheme(response.data)
        }
      })
      .finally(() => {
        setIsInitialized(true)
      })

    const unsubscribe = window.electron.onThemeChange((newTheme) => {
      setSystemTheme(newTheme)
    })

    return unsubscribe
  }, [])

  useEffect((): void => {
    if (!isInitialized) return

    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    root.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme, isInitialized])

  const setTheme = (newTheme: Theme): void => {
    setThemeState(newTheme)
    localStorage.setItem('app-theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
