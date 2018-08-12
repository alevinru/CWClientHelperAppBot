import find from 'lodash/find';
import { cw, CW_BOT_ID } from '../services/cw';

const { PHRASE_NOT_IMPLEMENTED } = process.env || 'What ?';

const debug = require('debug')('laa:cwb:message');

export default async function ({ message, from: { id: userId }, reply }, next) {

  await next();

  const { forward_from: from, entities, text } = message;
  const codeEntity = find(entities, { type: 'code' });

  debug('from:', userId, message.text);

  if (!from || !codeEntity) {
    reply(PHRASE_NOT_IMPLEMENTED);
    return;
  }

  const { id: fromId } = from;
  const { offset, length } = codeEntity;
  const code = text.substr(offset, length);

  if (fromId === CW_BOT_ID) {
    try {
      const token = await cw.sendGrantToken(userId, code);
      reply('Auth success!');
      debug('token:', token);
    } catch (e) {
      reply(e);
    }
  } else {
    reply(`Forward from bot id ${fromId} ignored`);
  }

}
