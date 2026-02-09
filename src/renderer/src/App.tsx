import { ThemeProvider } from './sessionly/theme/ThemeContext'
import { Layout } from './sessionly/layout/Layout'
import { SessionsPageShell } from './sessionly/sessions/SessionsPageShell'

function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <Layout>
        <SessionsPageShell />
      </Layout>
    </ThemeProvider>
  )
}

export default App
