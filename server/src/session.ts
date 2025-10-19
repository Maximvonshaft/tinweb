import { randomUUID } from 'node:crypto';
import type { SessionRecord, UserRecord } from './types';

const REMEMBER_DURATION = 7 * 24 * 60 * 60 * 1000;
const SESSION_DURATION = 2 * 60 * 60 * 1000;

export class SessionManager {
  private sessions = new Map<string, SessionRecord>();

  createSession(user: UserRecord, remember: boolean): SessionRecord {
    const id = randomUUID();
    const now = Date.now();
    const expiresAt = remember ? now + REMEMBER_DURATION : now + SESSION_DURATION;
    const session: SessionRecord = { id, user, createdAt: now, expiresAt, remember };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string | undefined): SessionRecord | undefined {
    if (!id) return undefined;
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (session.expiresAt && session.expiresAt < Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  destroySession(id: string | undefined): void {
    if (!id) return;
    this.sessions.delete(id);
  }

  touchSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.expiresAt = Date.now() + (session.remember ? REMEMBER_DURATION : SESSION_DURATION);
    this.sessions.set(id, session);
  }
}
