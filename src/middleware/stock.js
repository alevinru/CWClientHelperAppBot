import lo from 'lodash';

import { cw, getAuthToken } from '../services';
import { getToken, cachedProfile } from '../services/auth';
import log from '../services/log';
import { itemCodeByName } from '../services/cw';

import * as s from '../services/stocking';

const { debug } = log('mw:stock');

export async function stockInfo(ctx) {

  const { session, from: { id: sessionUserId } } = ctx;
  const [, matchUserId] = ctx.match;
  const userId = matchUserId || sessionUserId;

  debug('stockInfo', userId);

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

export async function potionsInfo(ctx) {

  const { from, session } = ctx;

  if (!session.profile) {
    await ctx.replyWithHTML('You need /auth to view potions');
    return;
  }

  const token = getAuthToken(session);

  if (!token) {
    await ctx.replyWithHTML('You need /auth to view potions');
    return;
  }

  const profile = await cachedProfile(from.id);

  try {

    const { stock } = await cw.requestStock(parseInt(from.id, 0), token);
    const info = s.potionPackInfo(stock);

    const reply = [
      `<code>${profile.lvl}</code> <b>${profile.userName}</b> VPB packs`,
      '',
    ];

    if (info.length) {
      reply.push(...info.map(potionPackListItem));
    } else {
      reply.push('No potions at all!');
    }

    await ctx.replyWithHTML(reply.join('\n'));

  } catch (e) {
    if (e.requiredOperation) {
      await ctx.replyWithHTML('You have to /authStock to view potions');
      return;
    }
    ctx.replyError('/potions', e);
  }

}


function potionPackListItem(pack) {
  const { potionType, qty, icon } = pack;
  return [
    `${icon} <b>${qty}</b> ${potionType}`,
    `(${['vial', 'potion', 'bottle'].map(name => pack.items[name] || 0).join(',')})`,
  ].join(' ');
}
