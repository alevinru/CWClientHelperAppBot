import map from 'lodash/map';
import orderBy from 'lodash/orderBy';
import findIndex from 'lodash/findIndex';
import find from 'lodash/find';
import filter from 'lodash/filter';
import { checkViewAuth, getOwnTag } from './profile';
import * as a from '../services/auth';
import log from '../services/log';

const { debug } = log('mw:gear');

export default async function (ctx) {

  const { session, from: { id: fromUserId }, message } = ctx;
  const { match } = ctx;
  const [, matchUserId] = match;

  debug(fromUserId, message.text, match);

  const ownTag = await getOwnTag(ctx);

  try {

    const userId = matchUserId || fromUserId;

    const info = await a.gearInfo(userId, !matchUserId && session);

    const profile = await a.refreshProfile(userId, !matchUserId && session);

    await checkViewAuth(ctx, ownTag, profile.guild_tag, userId, fromUserId);

    await ctx.replyWithHTML([
      formatProfileTitle(profile),
      formatGear(info),
    ].join('\n\n'));

    debug(`GET /gear/${userId}`, info);

  } catch (e) {

    if (!e.message) {
      if (e.requiredOperation) {
        const who = matchUserId ? 'The user has' : 'You have';
        await ctx.replyWithHTML(`${who} to do /authGear first`);
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
  { ring: '🎒', showIcon: true },
  { amulet: '✨', showIcon: true },
];

function formatGear({ gearInfo: info }) {

  const gearArray = map(info, gearItem);
  const sorted = orderBy(gearArray, ({ type }) => findIndex(gearIcons, type));
  const gearList = map(sorted, gearItemHtml);

  return [
    ...gearList,
  ].join('\n');

}

function gearIcon(gear) {
  const item = find(gearIcons, gear);
  return (item && item.showIcon) ? item[gear] : '';
}

function gearItem(gear, type) {
  return { type, icon: gearIcon(type), ...gear };
}


const qualityLetter = {
  Fine: 'E',
  High: 'D',
  Great: 'C',
  Excellent: 'B',
  Masterpiece: 'A',
};

function gearItemHtml(gear) {

  const { name, icon, stam } = gear;
  const { atk, def, quality } = gear;

  const broken = gear.condition === 'broken' ? '🛠' : '';

  const stats = [
    quality && `(${qualityLetter[quality]})`,
    atk && `⚔${atk}`,
    def && `🛡${def}`,
    gear.mana && `💧${gear.mana}`,
    stam && `+${stam}🔋`,
  ];

  return filter([
    icon,
    broken ? `${broken}${/\+/.test(name) ? '' : ' '}${name.replace('⚡', '')}` : name,
    ...stats,
  ]).join(' ');

}
