import { buildApp } from './app.js';
import { config } from './config/index.js';
import { closeDb } from './db/client.js';

const app = buildApp();
let isShuttingDown = false;

app.addHook('onClose', async () => {
  await closeDb();
});

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  try {
    app.log.info({ signal }, 'Shutting down Grow backend');
    await app.close();
  } catch (error) {
    app.log.error({ error, signal }, 'Failed to shut down Grow backend');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await app.listen({
    host: config.HOST,
    port: config.PORT,
  });
} catch (error) {
  app.log.error({ error }, 'Failed to start Grow backend');
  process.exitCode = 1;
  await shutdown('LISTEN_ERROR');
}
