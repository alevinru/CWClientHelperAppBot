import { cw, getAuthToken } from '../services';

const debug = require('debug')('laa:cwb:stock');

export default async function (ctx) {

  const { session, from: { id: userId } } = ctx;

  debug(userId);

  try {
    const token = getAuthToken(session);
    const { stock } = await cw.requestStock(parseInt(userId, 0), token);
    ctx.replyJson(stock);
    debug(`GET /stock/${userId}`, Object.keys(stock).length, 'items');
  } catch (e) {
    ctx.replyError('/stock', e);
  }

}
