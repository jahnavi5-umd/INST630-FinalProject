// Usage: npm run seed   (requires MONGODB_URI)
import { config } from "../config.js";
import { connectDB, disconnectDB } from "../db.js";
import { seedDatabase } from "./seedDatabase.js";

if (!config.mongoUri) {
  console.error("Set MONGODB_URI before seeding a persistent database.");
  process.exit(1);
}

await connectDB();
await seedDatabase({ reset: process.argv.includes("--reset") });
await disconnectDB();

