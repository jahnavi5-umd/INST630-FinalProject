import { config } from "./config.js";
import { disconnectDB, ensureInitialized } from "./db.js";
import app from "./app.js";

export { ensureInitialized };
export default app;

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
