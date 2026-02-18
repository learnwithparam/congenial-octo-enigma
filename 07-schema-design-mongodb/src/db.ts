import { MongoClient, Db } from 'mongodb';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/launchpad';

const client = new MongoClient(MONGODB_URI);

let db: Db;

/** Connect to MongoDB and return the database instance. */
export async function connectDb(): Promise<Db> {
  if (db) return db;
  await client.connect();
  db = client.db();
  console.log(`Connected to MongoDB: ${db.databaseName}`);
  return db;
}

/** Close the MongoDB connection. */
export async function closeDb(): Promise<void> {
  await client.close();
  console.log('MongoDB connection closed.');
}

export { client };
