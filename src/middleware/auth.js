import { cw } from '../services';

const debug = require('debug')('laa:cwb:auth');

export default async function (ctx) {

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
