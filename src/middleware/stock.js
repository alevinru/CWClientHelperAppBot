import lo from 'lodash';

import { cw, getAuthToken } from '../services';
import { getToken } from '../services/auth';
import log from '../services/log';
import { itemCodeByName } from '../services/cw';
import * as s from '../services/stocking';

const { debug } = log('mw:stock');

export default async function (ctx) {

  const { session, from: { id: sessionUserId } } = ctx;
  const [, matchUserId] = ctx.match;
  const userId = matchUserId || sessionUserId;

  debug(userId);

  try {
    const token = matchUserId ? await getToken(matchUserId) : getAuthToken(session);

    const info = await cw.requestStock(parseInt(userId, 0), token);
    const { stock, stockLimit, stockSize } = info;
    const freeStock = stockLimit - stockSize;
    const alert = freeStock < 0 ? '⚠' : '';

    const filtered = lo.filter(s.stockArray(stock), item => {
      return /^[0-3]\d$/.test(itemCodeByName(item.name));
    });

    const res = [
      `Stock available: ${alert}<b>${freeStock}</b> of <b>${stockLimit}</b>`,
      '',
      ...lo.map(filtered, ({ qty, name }) => s.formatStockItem(name, qty))
        .sort(),
    ];

    await ctx.replyWithHTML(res.join('\n'));

    debug(`GET /stock/${userId}`, Object.keys(stock).length, 'items');

  } catch (e) {
    const who = matchUserId ? 'The user' : 'You';
    if (!e.message && e.requiredOperation) {
      await ctx.replyWithHTML(`<b>${who}</b> have to do /authStock first`);
      return;
    }
    ctx.replyError('/stock', e);
  }

}
