import map from 'lodash/map';
import orderBy from 'lodash/orderBy';
import findIndex from 'lodash/findIndex';
import find from 'lodash/find';
import filter from 'lodash/filter';
import lo from 'lodash';
import { checkViewAuth, getOwnTag } from './profile';
import * as a from '../services/auth';
import log from '../services/log';
import { getAuthorizedUsers } from '../services/users';

const { debug } = log('mw:gear');

const GEAR_TYPES = ['head', 'body', 'hands', 'feet', 'coat', 'weapon', 'offhand', 'ring', 'amulet'];

const GEAR_ICONS = [
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

export async function guildGear(ctx) {

  const { session, match } = ctx;

  const [, gearType] = match;

  debug('guildGear', gearType);

  const icon = find(GEAR_ICONS, gearType);

  if (!icon) {
    const replyError = [
      `⚠ Invalid gear type <b>${gearType}</b>, choose one of:`,
      '',
      ...GEAR_TYPES.map(type => `▪︎ /gg_${type}`),
    ];
    await ctx.replyWithHTML(replyError.join('\n'));
    return;
  }

  const users = lo.filter(await getAuthorizedUsers(session), 'profile');

  const promises = lo.orderBy(users, [({ profile: { lvl } }) => lvl], ['desc'])
    .map(user => {
      return a.gearInfo(user.id)
        .then(({ gearInfo: gear }) => ({ user, gear }))
        .catch(() => false);
    });

  const matched = lo.filter(await Promise.all(promises))
    .map(usersGearList);

  await ctx.replyWithHTML(matched.join('\n\n'));

  function usersGearList({ user, gear }) {

    const { profile: { lvl, class: cls, userName } } = user;

    // debug('usersGearList', userName, JSON.stringify(gear));

    const item = gear[gearType];

    return [
      `<code>${lvl}</code> ${cls} <b>${userName}</b>`,
      item ? gearItemHtml(item) : '⚠ not equipped',
    ].join('\n');

  }

}

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


function formatGear({ gearInfo: info }) {

  const gearArray = map(info, gearItem);
  const sorted = orderBy(gearArray, ({ type }) => findIndex(GEAR_ICONS, type));
  const gearList = map(sorted, gearItemHtml);

  return [
    ...gearList,
  ].join('\n');

}

function gearIcon(gear) {
  const item = find(GEAR_ICONS, gear);
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
