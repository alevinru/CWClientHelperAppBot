import { cw } from '../services/cw';

const debug = require('debug')('laa:cwb:stock');

export default async function ({ reply, from: { id: userId } }) {

  debug(userId);

  try {
    const stock = await cw.requestStock(userId);
    reply(stock);
    debug(`GET /stock/${userId}`, Object.keys(stock));
  } catch (e) {
    reply(`Tried requestStock, but got "${e}" exception`);
    throw new Error(e);
  }

}
