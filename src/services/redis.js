import redis from 'redis';
import { promisify } from 'util';

export const client = redis.createClient({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 0,
  enable_offline_queue: false,
});

export const setAsync = promisify(client.set).bind(client);
export const lrangeAsync = promisify(client.lrange).bind(client);
export const lremAsync = promisify(client.lrem).bind(client);
export const ltrimAsync = promisify(client.ltrim).bind(client);
export const lpushAsync = promisify(client.lpush).bind(client);
export const hgetAsync = promisify(client.hget).bind(client);
export const hsetAsync = promisify(client.hset).bind(client);

const debug = require('debug')('laa:cwc:redis');

client.on('error', err => {
  debug('Error', err);
});

client.on('connect', () => {
  debug('Redis connected');
});
