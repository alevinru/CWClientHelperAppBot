import redis from 'redis';
import { promisify } from 'util';
import log from './log';


const {
  REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_SOCK,
} = process.env;

const clientConfig = {
  db: REDIS_DB || 0,
  enable_offline_queue: false,
};

if (REDIS_SOCK) {
  clientConfig.path = REDIS_SOCK;
} else {
  clientConfig.host = REDIS_HOST || '127.0.0.1';
  clientConfig.port = REDIS_PORT || 6379;
}

export const client = redis.createClient(clientConfig);

export const setAsync = promisifyClient('set');
export const getAsync = promisifyClient('get');
export const delAsync = promisifyClient('del');
export const lrangeAsync = promisifyClient('lrange');
export const lremAsync = promisifyClient('lrem');
export const ltrimAsync = promisifyClient('ltrim');
export const lpushAsync = promisifyClient('lpush');
export const rpushAsync = promisifyClient('rpush');
export const hgetAsync = promisifyClient('hget');
export const hdelAsync = promisifyClient('hdel');
export const hgetallAsync = promisifyClient('hgetall');
export const hsetAsync = promisifyClient('hset');
export const hincrbyAsync = promisifyClient('hincrby');
export const hmsetAsync = promisifyClient('hmset');
export const execAsync = promisifyClient('exec');


const { debug, error } = log('redis');

const IDS_HASH = 'ids';

export function getId(name) {
  return hincrbyAsync(IDS_HASH, name, 1);
}

client.on('error', err => {
  error('Error', err);
});

client.on('connect', () => {
  debug('Redis connected');
});


function promisifyClient(cmd) {
  return promisify(client[cmd]).bind(client);
}
