import filter from 'lodash/filter';
import map from 'lodash/map';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import replace from 'lodash/replace';
import orderBy from 'lodash/orderBy';
import * as a from '../services/auth';
import { itemCodeByName } from '../services/cw';
import log from '../services/log';

const { debug, error } = log('mw:profile');

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

      const { stockLimit, stockSize } = info;
      const { tag, castle, name } = info;

      const freeStock = stockLimit - stockSize;
      const alert = freeStock < 0 ? '⚠' : '';

      const shortInfo = [
        `${castle} [${tag}] ${name}`,
        `Stock available: ${alert}<b>${freeStock}</b> of <b>${stockLimit}</b>`,
      ];

      await ctx.replyWithHTML(shortInfo.join('\n'));

    } else {
      const { stock } = info;
      const re = new RegExp(replace(filterItems, ' ', '.+'), 'i');
      const items = filter(map(stock, (qty, name) => re.test(name) && formatStockItem(name, qty)));
      if (!items.length) {
        await ctx.replyWithHTML(`No items on stock match <b>${filterItems}</b>`);
        return;
      }
      const reply = items.join('\n');
      await ctx.replyWithHTML(reply);
    }

    debug(`GET /guildInfo/${userId}`, info.tag);

  } catch (e) {
    error('guildInfo', e);
    if (!e.message) {
      if (e.requiredOperation) {
        await ctx.replyWithHTML('You have to do /authGuild first');
        return;
      }
    }
    await ctx.replyError('guildInfo', e.message || e);
  }

  function formatStockItem(name, qty) {
    const code = itemCodeByName(name);
    const codeLabel = code ? `<code>${code || '??'}</code>` : '';
    return filter(['▪', codeLabel, `${name}: ${qty}`]).join(' ');
  }

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
      await ctx.replyWithHTML(`No items in craft book match <b>${filterItems}</b>`);
      return;
    }

    const reply = orderBy(items).join('\n');
    await ctx.replyWithHTML(reply);

    debug(`GET /craftBook/${userId}`, info.tag);

  } catch (e) {
    await ctx.replyError('viewCraftBook', e);
  }

}


export async function gearInfo(ctx) {

  const { session, from: { id: fromUserId }, message } = ctx;
  const { match } = ctx;
  const [, matchUserId] = match;

  debug(fromUserId, message.text, match);

  try {

    const userId = matchUserId || fromUserId;

    const info = await a.gearInfo(userId, !matchUserId && session);

    const profile = await a.refreshProfile(userId, !matchUserId && session);


    await ctx.replyWithHTML([
      formatProfileTitle(profile),
      formatGear(info),
    ].join('\n\n'));

    debug(`GET /gear/${userId}`, info);

  } catch (e) {

    if (!e.message) {
      if (e.requiredOperation) {
        await ctx.replyWithHTML('You have to do /authGear first');
        return;
      }
    }

    await ctx.replyError('/gear', e);
  }

}

function formatProfileTitle(profile) {

  const {
    class: cls,
    userName,
    guild_tag: tag,
    castle,
  } = profile;

  return `${castle}${cls} <b>${tag ? `[${tag}] ` : ''}${userName}</b> gear:`;

}

const gearIcons = [
  { head: '⛑' },
  { body: '🎽' },
  { hands: '🧤' },
  { feet: '👞' },
  { coat: '🧥' },
  { weapon: '⚔️' },
  { offhand: '🗡️' },
  { ring: '🎒' },
  { amulet: '✨' },
];

function formatGear({ gear }) {

  const gearArray = map(gear, (name, type) => ({ name, type, icon: gearIcon(type) }));
  const sorted = orderBy(gearArray, ({ type }) => findIndex(gearIcons, type));
  const gearList = map(sorted, ({ name, icon }) => `${icon}: ${name}`);

  return [
    ...gearList,
  ].join('\n');

}

function gearIcon(gear) {
  const item = find(gearIcons, gear);
  return item ? item[gear] : '❓';
}
