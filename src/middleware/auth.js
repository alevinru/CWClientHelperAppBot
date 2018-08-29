import find from 'lodash/find';
import { setAuth, requestToken, requestAuth } from '../services/auth';
import { hello } from './hello';
import log from '../services/log';

const { debug } = log('mw:auth');

export async function auth(ctx) {

  const { reply, from: { id: userId } } = ctx;
  debug(userId);

  try {
    await requestAuth(userId);
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

    const token = await requestToken(userId, code);

    debug('token:', token);
    setAuth(session, token);

    ctx.replyPlain([
      '✅ Congratulations, authorization complete!\n',
      'Try /profile and /stock commands.',
    ]);

    await hello(ctx);

  } catch (e) {
    ctx.replyError('to complete authorization', e);
  }

}
