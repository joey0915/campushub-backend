import mongoose, { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';

// One database per test file, so parallel workers share the server but never each other's data.
const databaseUri = new URL(`campushub-test-${new Types.ObjectId().toHexString()}`, env.mongodbUri);

beforeAll(async (): Promise<void> => {
  await connectDatabase(databaseUri.toString());
});

// Every test starts from an empty database: no test depends on another's leftovers.
afterEach(async (): Promise<void> => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async (): Promise<void> => {
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});
