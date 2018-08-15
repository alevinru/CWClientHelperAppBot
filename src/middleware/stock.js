import { cw, getAuthToken } from '../services';

const debug = require('debug')('laa:cwb:stock');

export default async function (ctx) {

  const { session, reply, from: { id: userId } } = ctx;

  debug(userId);

  try {
    const token = getAuthToken(session);
    const stock = await cw.requestStock(parseInt(userId, 0), token);
    reply(stock);
    debug(`GET /stock/${userId}`, Object.keys(stock));
  } catch (e) {
    ctx.replyError('/stock', e);
  }

}
