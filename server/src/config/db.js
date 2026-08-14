import mongoose from 'mongoose';

export async function connectDB(uri) {
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri);
  return mongoose.connection;
}
