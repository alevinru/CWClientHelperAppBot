import filter from 'lodash/filter';
import map from 'lodash/map';
import get from 'lodash/get';
import replace from 'lodash/replace';
import orderBy from 'lodash/orderBy';
// import flatten from 'lodash/flatten';
import * as a from '../services/auth';
import * as util from '../services/util';
import * as s from '../services/stocking';

import { isTrusted } from '../services/users';
import log from '../services/log';
import * as p from '../services/profile';

const { debug, error } = log('mw:profile');

export const LEVEL_ICON = '🏅';

export default async function (ctx) {

  const { session, from: { id: fromUserId }, message } = ctx;
  const { match } = ctx;
  const [, matchUserId] = match;

  debug(fromUserId, message.text, match);

  const ownTag = await getOwnTag(ctx);

  try {

    const userId = matchUserId || fromUserId;

    const profile = await a.refreshProfile(userId, !matchUserId && session);

    await checkViewAuth(ctx, ownTag, profile.guild_tag, userId, fromUserId);

    await ctx.replyWithHTML(p.formatProfile(profile, matchUserId));

    debug(`GET /profile/${userId}`, profile.userName);

  } catch (e) {
    await ctx.replyError('/profile', e);
  }

}


export async function getOwnTag(ctx) {

  const { profile: ownProfile } = ctx.session;

  if (!ownProfile) {
    await ctx.replyWithHTML('You need /auth to view profiles');
    throw new Error('Not authorized');
  }

  const { guild_tag: ownTag } = ownProfile;

  return ownTag;

}


export async function checkViewAuth(ctx, ownTag, userTag, userId, fromUserId) {
  if (ownTag !== userTag || (!ownTag && !userTag && userId !== fromUserId)) {
    const notAuthorized = `You have no permission to view <code>${userId}</code>`;
    await ctx.replyWithHTML(notAuthorized);
    throw new Error('Not authorized');
  }
}

export async function guildInfo(ctx) {

  const { session, from: { id: userId }, message } = ctx;
  let replyUserId = get(message, 'reply_to_message.from.id');
  const [, filterItems] = ctx.match || [];

  debug(userId, message.text, filterItems, replyUserId);

  if (replyUserId === userId) {
    replyUserId = null;
  }

  try {

    debug('reply_to_message:', message, ctx.reply_to_message);
    // debug('ctx keys:', Object.keys(ctx));

    if (replyUserId && !await isTrusted(replyUserId, userId)) {
      // const replyUserName = get(message, 'reply_to_message.from.username');
      // await ctx.replyWithHTML(`You are not a trustee of <code>@${replyUserName}</code>`);
      // return;
      replyUserId = null;
    }

    const info = await a.guildInfo(replyUserId || userId, !replyUserId && session);
    const { tag, castle, name } = info;
    const { emoji } = info;
    const reply = [
      filter([
        castle,
        emoji,
        `[${tag}]`,
        name,
      ]).join(' '),
    ];

    if (!filterItems) {

      const { stockLimit, stockSize, glory } = info;
      const { repair } = info;
      const freeStock = stockLimit - stockSize;
      const alert = freeStock < 0 ? '⚠' : '';

      reply.push(`\n🎖 Glory: <b>${glory}</b>`);
      reply.push(`🛠 Guild repair: <b>${repair ? 'enabled' : 'disabled'}</b>`);
      reply.push(`📦 Stock available: ${alert}<b>${freeStock}</b> of <b>${stockLimit}</b>`);

    } else {

      const { itemCodes, stock } = info;

      const itemsFilter = stockFilter(filterItems);

      const matchingItems = (qty, itemName) => {
        const itemMatches = itemsFilter(qty, itemName);
        return itemMatches && s.formatStockItem(itemName, qty, itemCodes, true);
      };

      const items = filter(map(stock, matchingItems));

      if (!items.length) {
        reply.push(`\nNo items on stock match <code>${filterItems}</code>`);
      } else {
        reply.push(`🔎 <code>${filterItems}</code>`);
        reply.push('', ...items);
      }

    }

    await ctx.replyWithHTML(reply.join('\n'));
    debug(`GET /guildInfo/${userId}`, info.tag);

  } catch (e) {

    error('guildInfo', e);
    const who = replyUserId ? get(message, 'reply_to_message.from.username') : 'You';

    if (!e.message && e.requiredOperation) {
      await ctx.replyWithHTML(`<b>${who}</b> have to do /authGuild first`);
      return;
    }

    await ctx.replyError('guildInfo', e.message || e);

  }


}

function stockFilter(text) {

  const [, size] = text.match(/>[ ]?(\d+)$/) || [];

  if (size) {
    const sizeNumber = parseInt(size, 0);
    return qty => qty >= sizeNumber;
  }

  const re = util.searchRe(text);

  debug('stockFilter', re);

  return (qty, itemName) => re.test(itemName);

}

export async function craftBook(ctx) {

  const { session, from: { id: userId }, message } = ctx;
  const { match } = ctx;
  const [, , filterItems] = match;

  debug(userId, message.text, filterItems);

  try {

    const info = await a.craftBook(userId, session);


    const { alchemy, craft } = info;
    const options = [...alchemy, ...craft];
    const re = new RegExp(replace(filterItems || '.*', ' ', '.+'), 'i');

    const items = filter(map(options, ({ id, name, price }) => {
      if (!re.test(name)) {
        return '';
      }
      return `▪︎ <code>${id}</code> ${name}: ${price}💰`;
    }));

    if (!items.length) {
      await ctx.replyWithHTML(`No items in craft book match <code>${filterItems}</code>`);
      return;
    }

    await ctx.replyWithHTML([
      `Recipes match: <b>${items.length}</b>`,
      '',
      ...orderBy(items),
    ].join('\n'));

    debug(`GET /craftBook/${userId}`, info.tag);

  } catch (e) {
    if (!e.message && e.requiredOperation) {
      await ctx.replyWithHTML('You have to do /authCraftBook to view your craft info');
    } else {
      error(e);
      await ctx.replyError('viewCraftBook', e.message || e);
    }
  }

}
