import { create } from 'zustand';

type TaskStatus = 'queued' | 'running' | 'succeed' | 'failed';

export interface DriveTask {
  id: string;
  title: string;
  status: TaskStatus;
  progress?: number;
  speed_bps?: number;
  eta_seconds?: number;
  error?: string | null;
  updatedAt: number;
}

interface TasksState {
  tasks: Record<string, DriveTask>;
  upsertTask: (task: DriveTask) => void;
  removeTask: (id: string) => void;
  reset: () => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: {},
  upsertTask: (task) =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [task.id]: { ...state.tasks[task.id], ...task, updatedAt: Date.now() },
      },
    })),
  removeTask: (id) =>
    set((state) => {
      const tasks = { ...state.tasks };
      delete tasks[id];
      return { tasks };
    }),
  reset: () => set({ tasks: {} }),
}));
