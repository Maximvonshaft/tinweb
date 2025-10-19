import type { Kysely } from 'kysely';
import type { Database } from '../database/schema.js';
import type { TaskScheduler } from '../modules/tasks/task-scheduler.js';

export interface ApplicationContext {
  db: Kysely<Database>;
  taskScheduler: TaskScheduler;
}
