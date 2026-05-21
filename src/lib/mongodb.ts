import { MongoClient } from "mongodb";

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

export function mongoClientPromise(): Promise<MongoClient> {
  if (global.__mongoClientPromise) return global.__mongoClientPromise;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in environment variables");
  global.__mongoClientPromise = new MongoClient(uri).connect();
  return global.__mongoClientPromise;
}
