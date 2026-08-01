import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDb() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db('codeforces');
  console.log('[db] Connected to MongoDB');
  return db;
}

export async function getProblemsCollection() {
  const database = await connectDb();
  return database.collection('problems');
}

export async function getIndexCollection() {
  const database = await connectDb();
  return database.collection('problem_index');
}

export async function getImagesCollection() {
  const database = await connectDb();
  return database.collection('images');
}
