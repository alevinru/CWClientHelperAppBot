import find from 'lodash/find';
import { cw, CW_BOT_ID } from '../services/cw';
import { setAuth } from '../services/auth';
import { errorReply } from '../services';

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

  debug('from:', userId, message.text);

  if (!from || !codeEntity) {
    reply(PHRASE_NOT_IMPLEMENTED);
    return;
  }

  const { id: fromId } = from;
  const { offset, length } = codeEntity;
  const code = text.substr(offset, length);

  if (fromId === CW_BOT_ID) {
    reply(`Forward from bot id ${fromId} ignored`);
    return;
  }

  try {
    const auth = await cw.sendGrantToken(parseInt(userId, 0), code);
    setAuth(session, auth);
    debug('token:', auth);
    reply('Congratulations, authorization complete! Try /profile and /stock commands.');
  } catch (e) {
    reply(errorReply('to complete authorization', e));
  }

}
