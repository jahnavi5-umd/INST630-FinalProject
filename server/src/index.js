import { config } from "./config.js";
import { connectDB, disconnectDB } from "./db.js";
import { createApp } from "./app.js";
import { seedDatabase } from "./seed/seedDatabase.js";

const app = createApp();

let initPromise = null;

export function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();
      await seedDatabase(); // no-op when events already exist
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export default async function handler(req, res) {
  await ensureInitialized();
  return app(req, res);
}

if (!process.env.VERCEL) {
  await ensureInitialized();
  const server = app.listen(config.port, () => {
    console.log(`[api] TerpLink API listening on http://localhost:${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
