import filter from 'lodash/filter';
import map from 'lodash/map';
import replace from 'lodash/replace';
import orderBy from 'lodash/orderBy';
import * as a from '../services/auth';
import log from '../services/log';

const { debug } = log('mw:profile');

export default async function (ctx) {

  const { session, from: { id: fromUserId }, message } = ctx;
  const { match } = ctx;
  const [, matchUserId] = match;

  debug(fromUserId, message.text, match);

  try {

    const userId = matchUserId || fromUserId;

    const profile = await a.refreshProfile(userId, !matchUserId && session);

    ctx.replyJson(profile);

    debug(`GET /profile/${userId}`, profile.userName);

  } catch (e) {
    ctx.replyError('/profile', e);
  }

}

export async function guildInfo(ctx) {

  const { session, from: { id: userId }, message } = ctx;
  const { match } = ctx;
  const [, , filterItems] = match;

  debug(userId, message.text, filterItems);

  try {

    const info = await a.guildInfo(userId, session);

    if (!filterItems) {
      await ctx.replyJson(info);
    } else {
      const { stock } = info;
      const re = new RegExp(replace(filterItems, ' ', '.+'), 'i');
      const items = filter(map(stock, (qty, name) => re.test(name) && `▪︎ ${name}: ${qty}`));
      if (!items.length) {
        await ctx.replyWithHTML(`No items on stock match <b>${filterItems}</b>`);
        return;
      }
      const reply = orderBy(items).join('\n');
      await ctx.replyWithHTML(reply);
    }

    debug(`GET /guildInfo/${userId}`, info.tag);

  } catch (e) {
    ctx.replyError('/guildInfo', e);
  }

}
