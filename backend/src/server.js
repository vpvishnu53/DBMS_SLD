require('dotenv').config({ quiet: true });
const { initPool, closePool } = require('./config/db');
const { buildRegistry } = require('./resources');
const { createApp } = require('./app');

async function main() {
  for (const k of ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING', 'JWT_SECRET']) {
    if (!process.env[k]) throw new Error(`Missing env var ${k} (see backend/.env.example)`);
  }
  await initPool();
  const registry = await buildRegistry(); // introspects the Oracle data dictionary
  const app = createApp(registry);
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () =>
    console.log(`SLMS API listening on http://localhost:${port}/api  (${registry.resources.length} resources)`));

  const shutdown = async (sig) => {
    console.log(`\n${sig} received, shutting down...`);
    server.close();
    await closePool().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start API:', err.message);
  process.exit(1);
});
