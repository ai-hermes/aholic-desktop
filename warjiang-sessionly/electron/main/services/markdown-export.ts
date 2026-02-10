import type { Session } from './session-store'

export function sessionToMarkdown(session: Session): string {
  const title = session.title || `Session ${session.id}`
  const date = session.updatedAt || session.createdAt || new Date()

  return `# ${title}

**Session ID:** ${session.id}
**Project:** ${session.projectEncoded}
**Date:** ${date.toLocaleString()}

${session.content ? JSON.stringify(session.content, null, 2) : 'No content available'}
`
}

export function generateExportFilename(session: Session): string {
  const date = session.updatedAt || session.createdAt || new Date()
  const dateStr = date.toISOString().split('T')[0]
  const title = session.title || `session-${session.id}`
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()

  return `${safeTitle}-${dateStr}.md`
}
