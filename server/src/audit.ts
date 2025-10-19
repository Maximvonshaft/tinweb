import { randomUUID } from 'node:crypto';
import type { AuditEntry, UserRecord } from './types';

export class AuditTrail {
  private entries: AuditEntry[] = [];

  record(actor: UserRecord, action: string, target: string, detail?: Record<string, unknown>) {
    const entry: AuditEntry = {
      id: randomUUID(),
      actor: actor.username,
      ts: Date.now(),
      action,
      target,
      detail,
    };
    this.entries.push(entry);
    if (this.entries.length > 2000) {
      this.entries.shift();
    }
  }

  list(): AuditEntry[] {
    return [...this.entries];
  }
}
