import mongoose from 'mongoose';
import log from '../services/log';

const { debug } = log('mongoose');

const mongoUrl = process.env.MONGO_URL;

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set('debug', true);
}

mongoose.set('strictQuery', false);

export async function connect() {
  const connected = await mongoose.connect(`mongodb://${mongoUrl}`);
  debug('connected', mongoUrl);
  return connected;
}

export async function disconnect() {
  return mongoose.disconnect();
}
