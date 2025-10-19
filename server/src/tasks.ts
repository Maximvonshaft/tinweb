import { randomUUID } from 'node:crypto';
import type { FileStore } from './store';
import type { QueueSnapshot, TaskState } from './types';

const COPY_SIMULATION_STEPS = [
  { progress: 0.2, eta: 5 },
  { progress: 0.45, eta: 3 },
  { progress: 0.8, eta: 1 },
  { progress: 1, eta: 0 },
];

export class TaskManager {
  private tasks = new Map<string, TaskState>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly store: FileStore) {}

  queueCopyTask(sourceId: string, targetDriveId: string, targetParentId: string | null): string {
    const taskId = randomUUID();
    const now = Date.now();
    const task: TaskState = {
      id: taskId,
      type: 'copy',
      status: 'pending',
      progress: 0,
      speedBps: 0,
      etaSeconds: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(taskId, task);

    let stepIndex = 0;
    const runStep = () => {
      const currentStep = COPY_SIMULATION_STEPS[stepIndex];
      if (!currentStep) return;
      const speed = 512_000 + Math.random() * 2_000_000;
      this.updateTask(taskId, {
        status: 'running',
        progress: Math.round(currentStep.progress * 100),
        speedBps: Math.round(speed),
        etaSeconds: currentStep.eta,
      });
      stepIndex += 1;
      if (stepIndex >= COPY_SIMULATION_STEPS.length) {
        this.finishCopy(taskId, sourceId, targetDriveId, targetParentId);
        return;
      }
      const timer = setTimeout(runStep, 1000);
      this.timers.set(taskId, timer);
    };

    const timer = setTimeout(runStep, 250);
    this.timers.set(taskId, timer);
    return taskId;
  }

  queueIndexerTask(): string {
    const taskId = randomUUID();
    const now = Date.now();
    const task: TaskState = {
      id: taskId,
      type: 'index',
      status: 'running',
      progress: 5,
      speedBps: null,
      etaSeconds: 3,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(taskId, task);

    const timer = setTimeout(() => {
      this.updateTask(taskId, { status: 'success', progress: 100, etaSeconds: 0 });
      this.clearTimer(taskId);
    }, 2500);
    this.timers.set(taskId, timer);
    return taskId;
  }

  getTask(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  getQueueSnapshot(): QueueSnapshot {
    let pending = 0;
    let running = 0;
    let failed = 0;
    this.tasks.forEach((task) => {
      if (task.status === 'pending') pending += 1;
      if (task.status === 'running') running += 1;
      if (task.status === 'failed') failed += 1;
    });
    return { pending, running, failed };
  }

  private finishCopy(taskId: string, sourceId: string, targetDriveId: string, targetParentId: string | null) {
    try {
      this.store.copy({ id: sourceId, targetDriveId, targetParentId });
      this.updateTask(taskId, { status: 'success', progress: 100, speedBps: 0, etaSeconds: 0 });
    } catch (error) {
      this.updateTask(taskId, {
        status: 'failed',
        progress: 100,
        error: (error as Error).message,
        speedBps: 0,
        etaSeconds: 0,
      });
    } finally {
      this.clearTimer(taskId);
    }
  }

  private updateTask(taskId: string, patch: Partial<Omit<TaskState, 'id' | 'type' | 'createdAt'>>) {
    const existing = this.tasks.get(taskId);
    if (!existing) return;
    const next: TaskState = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    this.tasks.set(taskId, next);
  }

  private clearTimer(taskId: string) {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
  }
}
