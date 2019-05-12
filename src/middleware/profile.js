import filter from 'lodash/filter';
import map from 'lodash/map';
import get from 'lodash/get';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import replace from 'lodash/replace';
import orderBy from 'lodash/orderBy';
import * as a from '../services/auth';

import log from '../services/log';
import { formatStockItem } from './stock';
import { isTrusted } from '../services/users';

const { debug, error } = log('mw:profile');

export default async function (ctx) {

  const { session, from: { id: fromUserId }, message } = ctx;
  const { match } = ctx;
  const [, matchUserId] = match;

  debug(fromUserId, message.text, match);

  try {

    const userId = matchUserId || fromUserId;

    const profile = await a.refreshProfile(userId, !matchUserId && session);

    await ctx.replyWithHTML(formatProfile(profile));

    debug(`GET /profile/${userId}`, profile.userName);

  } catch (e) {
    ctx.replyError('/profile', e);
  }

}


function formatProfile(profile) {

  const { userName, guild_tag: tag } = profile;
  const { class: cls, castle } = profile;

  const { mana, gold, pouches } = profile;
  const { stamina, exp } = profile;
  const { atk, def, lvl } = profile;

  const nameTag = tag ? `[${tag}] ` : '';

  const res = [
    `${cls}${castle} <b>${nameTag || ''}${userName}</b>`,
    `🏅${lvl} ⚔${atk} 🛡${def} 🔥${exp}`,
    `💰${gold} 👝${pouches} 🔋${stamina}${mana ? `💧${mana}` : ''}`,
    '',
    '/gear /stock',
  ];

  return res.join('\n');

}

export async function guildInfo(ctx) {

  const { session, from: { id: userId }, message } = ctx;
  const replyUserId = get(message, 'reply_to_message.from.id');
  const [, , filterItems] = ctx.match;

  debug(userId, message.text, filterItems, replyUserId);

  try {

    debug('reply_to_message:', message, ctx.reply_to_message);
    // debug('ctx keys:', Object.keys(ctx));

    if (replyUserId && !await isTrusted(replyUserId, userId)) {
      const replyUserName = get(message, 'reply_to_message.from.username');
      await ctx.replyWithHTML(`You are not a trustee of <code>@${replyUserName}</code>`);
      return;
    }

    const info = await a.guildInfo(replyUserId || userId, !replyUserId && session);
    const { tag, castle, name } = info;
    const reply = [
      `${castle} [${tag}] ${name}`,
    ];

    if (!filterItems) {

      const { stockLimit, stockSize } = info;
      const freeStock = stockLimit - stockSize;
      const alert = freeStock < 0 ? '⚠' : '';

      reply.push(`Stock available: ${alert}<b>${freeStock}</b> of <b>${stockLimit}</b>`);

    } else {

      const { stock } = info;
      const re = new RegExp(replace(filterItems, ' ', '.+'), 'i');
      const matchesRe = (qty, itemName) => re.test(itemName) && formatStockItem(itemName, qty);
      const items = filter(map(stock, matchesRe));

      if (!items.length) {
        reply.push(`\nNo items on stock match <b>${filterItems}</b>`);
      } else {
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
