import redis from 'redis';
import { promisify } from 'util';

export const client = redis.createClient({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 0,
  enable_offline_queue: false,
});

export const setAsync = promisifyClient('set');
export const lrangeAsync = promisifyClient('lrange');
export const lremAsync = promisifyClient('lrem');
export const ltrimAsync = promisifyClient('ltrim');
export const lpushAsync = promisifyClient('lpush');
export const hgetAsync = promisifyClient('hget');
export const hsetAsync = promisifyClient('hset');

const debug = require('debug')('laa:cwc:redis');

client.on('error', err => {
  debug('Error', err);
});

client.on('connect', () => {
  debug('Redis connected');
});


function promisifyClient(cmd) {
  return promisify(client[cmd]).bind(client);
}
