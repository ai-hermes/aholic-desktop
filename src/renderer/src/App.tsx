import { ThemeProvider } from './claude/theme/ThemeProvider'
import { Layout } from './claude/layout/LayoutProvider'
import { SessionsPageShell } from './claude/sessions/SessionsPageShell'

function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <Layout>
        <div className="h-full">
          <SessionsPageShell />
        </div>
      </Layout>
    </ThemeProvider>
  )
}

export default App
