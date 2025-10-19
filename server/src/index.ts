import { buildServer } from './server';

const port = Number(process.env.PORT ?? 5174);
const host = process.env.HOST ?? '0.0.0.0';

async function main() {
  const app = buildServer();
  try {
    await app.listen({ port, host });
    app.log.info(`Federated Drive API listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
