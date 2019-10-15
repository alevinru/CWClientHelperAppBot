import RedisSession from 'telegraf-session-redis';
import { getAsync, clientConfig, setAsync } from './redis';
import log from './log';

const { debug, error } = log('session');

export default function (config) {

  const session = new RedisSession({
    store: { ...clientConfig },
    getSessionKey: ctx => ctx.from && sessionKey(config.botId, ctx.from.id),
  });

  const { client } = session;

  client.on('connect', () => {
    debug('Redis connected');
  });

  client.on('error', e => {
    error('Redis', e.name, e.message);
  });

  return session;

}


export function sessionKey(botId, userId) {
  return `session_${botId}_${userId}`;
}

export function getSession(botId, userId) {
  return getAsync(sessionKey(botId, userId))
    .then(json => JSON.parse(json));
}

export function saveSession(botId, userId, session) {
  return setAsync(sessionKey(botId, userId), JSON.stringify(session));
}
