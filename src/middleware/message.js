import find from 'lodash/find';
import { cw, CW_BOT_ID } from '../services/cw';
import { setAuth } from '../services/auth';

const { PHRASE_NOT_IMPLEMENTED } = process.env || 'What ?';

const debug = require('debug')('laa:cwb:message');

export default async function (ctx) {

  const {
    session,
    message,
    from: { id: userId },
    reply,
  } = ctx;

  const { forward_from: from, entities, text } = message;
  const codeEntity = find(entities, { type: 'code' });
  const { id: fromId } = from || {};

  debug('from:', userId, message.text);

  if (fromId && fromId !== CW_BOT_ID) {
    reply(`Forward from bot id ${fromId} ignored`);
    return;
  }

  if (!from || !codeEntity) {
    reply(PHRASE_NOT_IMPLEMENTED);
    return;
  }

  const { offset, length } = codeEntity;
  const code = text.substr(offset, length);

  try {
    const auth = await cw.sendGrantToken(parseInt(userId, 0), code);
    setAuth(session, auth);
    debug('token:', auth);
    reply('Congratulations, authorization complete! Try /profile and /stock commands.');
  } catch (e) {
    ctx.replyError('to complete authorization', e);
  }

}
