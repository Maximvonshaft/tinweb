import { randomUUID } from 'node:crypto';
import type { FileStore } from './store';
import type { ShareRecord } from './types';

export class ShareManager {
  private shares = new Map<string, ShareRecord>();

  constructor(private readonly store: FileStore) {
    const now = Date.now();
    this.addShare({
      token: 'public-demo',
      fileId: '2',
      requiresPassword: false,
      expiresAt: now + 1000 * 60 * 60 * 24,
    });
    this.addShare({
      token: 'secret-archive',
      fileId: '8',
      requiresPassword: true,
      password: '1234',
      expiresAt: now + 1000 * 60 * 60 * 12,
    });
  }

  getShare(token: string): ShareRecord | undefined {
    return this.shares.get(token);
  }

  ensureSession(token: string, sessionToken: string | undefined): boolean {
    const share = this.shares.get(token);
    if (!share) return false;
    if (!share.requiresPassword) return true;
    if (!sessionToken) return false;
    return share.sessionTokens.has(sessionToken);
  }

  unlockShare(token: string, password: string): string {
    const share = this.shares.get(token);
    if (!share) {
      throw new Error('分享不存在');
    }
    if (!share.requiresPassword) {
      const session = randomUUID();
      share.sessionTokens.add(session);
      return session;
    }
    if (share.password !== password) {
      throw new Error('口令错误');
    }
    const sessionToken = randomUUID();
    share.sessionTokens.add(sessionToken);
    return sessionToken;
  }

  private addShare(record: Omit<ShareRecord, 'sessionTokens'>) {
    if (!this.store.get(record.fileId)) {
      return;
    }
    this.shares.set(record.token, { ...record, sessionTokens: new Set<string>() });
  }
}
