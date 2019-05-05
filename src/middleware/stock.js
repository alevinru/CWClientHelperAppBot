import filter from 'lodash/filter';
import map from 'lodash/map';

import { cw, getAuthToken } from '../services';
import { getToken } from '../services/auth';
import log from '../services/log';
import { itemCodeByName } from '../services/cw';

const { debug } = log('mw:stock');

export default async function (ctx) {

  const { session, from: { id: sessionUserId }, message } = ctx;
  const match = message.text.match(/\/stock[ _]?(\d*)$/) || [];
  const [, matchUserId] = match;
  const userId = matchUserId || sessionUserId;
  debug(userId, match);

  try {
    const token = matchUserId ? await getToken(matchUserId) : getAuthToken(session);

    const info = await cw.requestStock(parseInt(userId, 0), token);
    const { stock, stockLimit, stockSize } = info;
    const freeStock = stockLimit - stockSize;
    const alert = freeStock < 0 ? '⚠' : '';

    const filtered = filter(map(stock, (qty, name) => {
      const code = itemCodeByName(name);
      return /^[0-3]\d$/.test(code) && { name, qty };
    }));

    const res = [
      `Stock available: ${alert}<b>${freeStock}</b> of <b>${stockLimit}</b>`,
      '',
      ...map(filtered, ({ qty, name }) => formatStockItem(name, qty)).sort(),
    ];

    await ctx.replyWithHTML(res.join('\n'));

    debug(`GET /stock/${userId}`, Object.keys(stock).length, 'items');

  } catch (e) {
    ctx.replyError('/stock', e);
  }

}

export function formatStockItem(name, qty) {
  const code = itemCodeByName(name);
  const codeLabel = code ? `<code>${code || '??'}</code>` : '';
  return filter(['▪', codeLabel, `${name}: ${qty}`]).join(' ');
}
