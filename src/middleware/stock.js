import { cw, getAuthToken, errorReply } from '../services';

const debug = require('debug')('laa:cwb:stock');

export default async function ({ session, reply, from: { id: userId } }) {

  debug(userId);

  try {
    const token = getAuthToken(session);
    const stock = await cw.requestStock(parseInt(userId, 0), token);
    reply(stock);
    debug(`GET /stock/${userId}`, Object.keys(stock));
  } catch (e) {
    reply(errorReply('/stock', e));
  }

}
