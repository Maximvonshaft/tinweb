import { randomUUID } from 'node:crypto';
import type { FileStore } from './store';
import type { TaskState } from './types';

export class TaskManager {
  private tasks = new Map<string, TaskState>();

  constructor(private readonly store: FileStore) {}

  queueCopyTask(sourceId: string, targetDisk: string, targetParentId: string | null): string {
    const taskId = randomUUID();
    const initialTask: TaskState = {
      id: taskId,
      status: 'queued',
      progress: 0,
      speedBps: null,
      etaSeconds: null,
      error: null,
    };
    this.tasks.set(taskId, initialTask);

    setTimeout(() => {
      this.updateTask(taskId, { status: 'running', progress: 25, speedBps: 1_024_000, etaSeconds: 2 });
    }, 300);

    setTimeout(() => {
      try {
        this.store.copy({ id: sourceId, targetDisk, targetParentId });
        this.updateTask(taskId, { status: 'succeed', progress: 100, speedBps: 0, etaSeconds: 0 });
      } catch (error) {
        this.updateTask(taskId, { status: 'failed', progress: 100, error: (error as Error).message });
      }
    }, 1200);

    return taskId;
  }

  queueIndexerTask(): string {
    const taskId = randomUUID();
    const running: TaskState = {
      id: taskId,
      status: 'running',
      progress: 5,
      speedBps: null,
      etaSeconds: 3,
      error: null,
    };
    this.tasks.set(taskId, running);
    setTimeout(() => {
      this.updateTask(taskId, { status: 'succeed', progress: 100, etaSeconds: 0 });
    }, 2000);
    return taskId;
  }

  getTask(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  getQueueSnapshot(): { waiting: number; running: number; failed: number } {
    let waiting = 0;
    let running = 0;
    let failed = 0;
    this.tasks.forEach((task) => {
      if (task.status === 'queued') waiting += 1;
      else if (task.status === 'running') running += 1;
      else if (task.status === 'failed') failed += 1;
    });
    return { waiting, running, failed };
  }

  private updateTask(taskId: string, patch: Partial<TaskState>) {
    const existing = this.tasks.get(taskId);
    if (!existing) return;
    this.tasks.set(taskId, { ...existing, ...patch });
  }
}
