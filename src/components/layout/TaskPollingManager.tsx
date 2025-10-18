import { useEffect } from 'react';
import { useTasksStore } from '@/stores/tasks';
import { useTaskStatusQuery } from '@/hooks/use-tasks';

function TaskPollingItem({ taskId }: { taskId: string }) {
  const upsertTask = useTasksStore((state) => state.upsertTask);
  const task = useTasksStore((state) => state.tasks[taskId]);
  const query = useTaskStatusQuery(taskId, Boolean(task));

  useEffect(() => {
    if (!task || !query.data) return;
    upsertTask({
      ...task,
      status: query.data.status,
      progress: query.data.progress ?? undefined,
      speed_bps: query.data.speed_bps ?? undefined,
      eta_seconds: query.data.eta_seconds ?? undefined,
      error: query.data.error ?? undefined,
      updatedAt: Date.now(),
    });
  }, [query.data, task, upsertTask]);

  return null;
}

export function TaskPollingManager() {
  const tasks = useTasksStore((state) => state.tasks);
  return (
    <>
      {Object.keys(tasks).map((taskId) => (
        <TaskPollingItem key={taskId} taskId={taskId} />
      ))}
    </>
  );
}
