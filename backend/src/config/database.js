import mongoose from 'mongoose';
import { env } from './env.js';
import User from '../modules/users/user.model.js';

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri);

  const indexes = await User.collection.indexes();
  const obsoleteIdentifierIndexes = indexes.filter(
    (index) =>
      index.unique &&
      Object.keys(index.key).length === 1 &&
      index.key.identifier === 1,
  );

  for (const index of obsoleteIdentifierIndexes) {
    await User.collection.dropIndex(index.name);
    console.log(`Removed obsolete user index: ${index.name}`);
  }

  await User.createIndexes();
  console.log('Connected to MongoDB');
}
