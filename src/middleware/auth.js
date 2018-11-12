import find from 'lodash/find';
import * as a from '../services/auth';
import { hello } from './hello';
import log from '../services/log';

const { debug } = log('mw:auth');

export async function auth(ctx) {

  const { reply, from: { id: userId } } = ctx;

  debug('auth:', userId);

  try {
    await a.requestAuth(userId);
    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward this message back here to complete authorization',
    ];
    reply(msg.join(' '));
  } catch (e) {
    ctx.replyError('to send auth code', e);
  }

}

export async function authGuildInfo(ctx) {

  const { from: { id: userId }, session } = ctx;

  debug('authGuildInfo:', userId);

  try {

    const token = a.getAuthToken(session);

    const { uuid } = await a.requestGuildInfoAuth(userId, token);

    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward this message back here to complete <b>Guild Info</b> authorization',
    ];

    session.authGuildInfoId = uuid;

    await ctx.replyHTML(msg.join(' '));

  } catch (e) {
    await ctx.replyError('to send auth code', e);
  }

}

export async function authCode(ctx, next) {

  const {
    session,
    message: { entities, text },
    from: { id: userId },
  } = ctx;

  if (!text || !text.match(/^Code .+/)) {
    await next();
    return;
  }

  const codeEntity = find(entities, { type: 'code' });

  if (!codeEntity) {
    await next();
    return;
  }

  const { offset, length } = codeEntity;
  const code = text.substr(offset, length);

  try {

    if (text.match(/to read your guild info/)) {

      const { authGuildInfoId } = session;
      const token = a.getAuthToken(session);

      debug('guildInfo code:', code, token, authGuildInfoId);

      if (!authGuildInfoId) {
        await ctx.replyHTML(`GuildInfo auth is not requested for userId ${userId}`);
      } else {
        await a.grantGuildInfoAuth(userId, authGuildInfoId, code, token);
        delete session.authGuildInfoId;
        session.isGuildInfoAuthorized = true;
        await ctx.replyHTML([
          '✅ Congratulations, guildInfo authorization complete!\n',
          'Try /guildInfo command.',
        ]);
      }

      return;

    }

    const token = await a.requestToken(userId, code);
    debug('token:', token);
    a.setAuth(session, token);

    ctx.replyPlain([
      '✅ Congratulations, authorization complete!\n',
      'Try /profile and /stock commands.',
    ]);

    await hello(ctx);

  } catch (e) {
    ctx.replyError('to complete authorization', e);
  }

}
