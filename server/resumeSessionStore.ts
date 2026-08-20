import type { KnowledgeSection } from "./defaultKnowledge";

export type InMemoryResumeSession = {
  shareToken: string;
  deleteToken: string;
  originalFilename: string;
  sections: KnowledgeSection[];
  expiresAt: Date;
  lastAccessedAt: Date;
};

const sessions = new Map<string, InMemoryResumeSession>();

export function pruneExpiredResumeSessions(now = new Date()) {
  let removed = 0;
  for (const [token, session] of Array.from(sessions.entries())) {
    if (session.expiresAt.getTime() <= now.getTime()) {
      sessions.delete(token);
      removed += 1;
    }
  }
  return removed;
}

export function createInMemoryResumeSession(session: InMemoryResumeSession) {
  pruneExpiredResumeSessions();
  sessions.set(session.shareToken, session);
  return session;
}

export function getInMemoryResumeSession(shareToken: string) {
  const session = sessions.get(shareToken);
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    sessions.delete(shareToken);
    return undefined;
  }
  session.lastAccessedAt = new Date();
  return session;
}

export function deleteInMemoryResumeSession(shareToken: string, deleteToken: string) {
  const session = getInMemoryResumeSession(shareToken);
  if (!session || session.deleteToken !== deleteToken) return false;
  sessions.delete(shareToken);
  return true;
}

export function clearInMemoryResumeSessionsForTest() {
  sessions.clear();
}
