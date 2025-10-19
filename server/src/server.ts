import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createDb } from './database/client.js';
import { migrateToLatest } from './database/migrations.js';
import { seedDatabase } from './database/seed.js';
import { createTaskScheduler } from './modules/tasks/task-scheduler.js';
import { createApp } from './app/app.js';
import type { ApplicationContext } from './app/context.js';
import { logger } from './core/logger.js';

const bootstrap = async () => {
  const db = createDb();
  await migrateToLatest(db);
  await seedDatabase(db);

  const taskScheduler = createTaskScheduler(db);
  const context: ApplicationContext = {
    db,
    taskScheduler
  };

  const app = createApp(context);
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, '服务已启动');
  });

  taskScheduler.start();

  const shutdown = () => {
    logger.info('正在关闭服务');
    taskScheduler.stop();
    server.close(() => {
      logger.info('HTTP 服务已关闭');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

bootstrap().catch((error) => {
  logger.error({ err: error }, '启动失败');
  process.exit(1);
});
