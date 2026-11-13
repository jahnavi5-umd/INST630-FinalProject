import mongoose from "mongoose";
import { config } from "./config.js";
import { User } from "./models/User.js";
import { Event } from "./models/Event.js";
import { Organization } from "./models/Organization.js";
import { attachEmbeddedStore } from "./embeddedDb.js";
import { seedDatabase } from "./seed/seedDatabase.js";

let connected = false;
let connectPromise = null;
let initPromise = null;

export async function connectDB() {
  if (connected && (!config.mongoUri || mongoose.connection.readyState === 1)) {
    return;
  }
  if (connectPromise) {
    return connectPromise;
  }

  // Drop unknown fields from query filters. Operator injection ({ "$gt": "" })
  // is blocked upstream by express-mongo-sanitize + explicit type checks.
  mongoose.set("strictQuery", true);

  connectPromise = (async () => {
    if (config.mongoUri) {
      await mongoose.connect(config.mongoUri, {
        dbName: config.mongoDbName,
        autoIndex: !config.isProd,
        serverSelectionTimeoutMS: 10000,
      });
      connected = true;
      console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
      return;
    }

    attachEmbeddedStore([User, Event, Organization]);
    connected = true;
    console.log("[db] MONGODB_URI not set - using embedded persistent store (server/.data/terplink.json).");
  })();

  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export function ensureInitialized() {
  if (connected && (!config.mongoUri || mongoose.connection.readyState === 1) && initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    await connectDB();
    await seedDatabase(); // no-op when events already exist
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export async function disconnectDB() {
  if (connected) {
    await mongoose.disconnect();
    connected = false;
  }
}
