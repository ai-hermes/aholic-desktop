export interface Session {
  id: string
  projectEncoded: string
  title?: string
  content?: any
  createdAt?: Date
  updatedAt?: Date
}

export async function getAllSessions(): Promise<Session[]> {
  console.warn('getAllSessions not implemented yet')
  return []
}

export async function getSession(
  sessionId: string,
  projectEncoded: string
): Promise<Session | null> {
  console.warn('getSession not implemented yet', { sessionId, projectEncoded })
  return null
}

export async function saveSession(session: Session): Promise<void> {
  console.warn('saveSession not implemented yet', session)
}

export async function deleteSession(sessionId: string, projectEncoded: string): Promise<void> {
  console.warn('deleteSession not implemented yet', { sessionId, projectEncoded })
}
