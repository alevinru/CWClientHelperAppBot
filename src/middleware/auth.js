import find from 'lodash/find';
import { cw } from '../services';
import { setAuth } from '../services/auth';
import hello from './hello';

const debug = require('debug')('laa:cwb:auth');

export async function auth(ctx) {

  const { reply, from: { id: userId } } = ctx;
  debug(userId);

  try {
    await cw.sendAuth(parseInt(userId, 0));
    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward this message back here to complete authorization',
    ];
    reply(msg.join(' '));
  } catch (e) {
    ctx.replyError('to send auth code', e);
  }

}

export async function authCode(ctx, next) {

  const {
    state,
    session,
    message: { entities, text },
    reply,
    from: { id: userId },
  } = ctx;

  const codeEntity = find(entities, { type: 'code' });

  if (!codeEntity) {
    await next();
    return;
  }

  const { offset, length } = codeEntity;
  const code = text.substr(offset, length);

  state.processed = true;

  try {
    const token = await cw.sendGrantToken(parseInt(userId, 0), code);
    setAuth(session, token);
    debug('token:', token);
    reply('✅ Congratulations, authorization complete! Try /profile and /stock commands.');
    await hello(ctx);
  } catch (e) {
    ctx.replyError('to complete authorization', e);
  }

}
