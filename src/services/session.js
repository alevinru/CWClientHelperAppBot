import RedisSession from 'telegraf-session-redis';

const debug = require('debug')('laa:cwb:session');

export default function (config) {

  const session = new RedisSession({
    store: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      db: process.env.REDIS_DB || 0,
      enable_offline_queue: false,
    },
    getSessionKey: ctx => ctx.from && `${config.botId}:${ctx.from.id}`,
  });

  const { client } = session;

  client.on('connect', () => {
    debug('Redis connected');
  });

  client.on('error', e => {
    debug('Redis', e.name, e.message);
  });

  return session;

}
