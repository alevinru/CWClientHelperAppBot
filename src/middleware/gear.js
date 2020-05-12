import map from 'lodash/map';
import orderBy from 'lodash/orderBy';
import findIndex from 'lodash/findIndex';
import find from 'lodash/find';
import filter from 'lodash/filter';
import lo from 'lodash';
import { checkViewAuth, getOwnTag } from './profile';
import * as a from '../services/auth';
import * as s from '../services/stocking';
import * as g from '../services/gearing';
import log from '../services/log';
import { getAuthorizedUsers } from '../services/users';
import { numberKM } from '../services/util';

const { debug, error } = log('mw:gear');

const GEAR_TYPES = ['head', 'body', 'hands', 'feet', 'coat', 'weapon', 'offhand', 'ring', 'amulet'];

const GEAR_ICONS = [
  { head: '🧢' },
  { body: '👕' },
  { hands: '🧤' },
  { feet: '👞' },
  { coat: '🧥' },
  { weapon: '⚔️' },
  { offhand: '🗡️' },
  { ring: '💍', showIcon: true },
  { amulet: '🧿', showIcon: true },
];

const MAGIC_DUST = 'Magic dust';

export async function guildBalls(ctx) {
  const { session } = ctx;
  const users = lo.filter(await getAuthorizedUsers(session), 'profile');

  const promises = lo.orderBy(users, [({ profile: { lvl } }) => lvl], ['desc'])
    .map(user => {
      return a.stockInfo(user.id)
        .then(({ stock }) => ({
          user,
          balls: stockBalls(stock),
          dust: stock[MAGIC_DUST],
        }))
        .catch(() => false);
    });
  const allData = await Promise.all(promises);
  const ballsByUser = lo.filter(allData, ({ balls, dust }) => balls && balls.length || dust);

  if (!ballsByUser.length) {
    await ctx.replyWithHTML('Your guild has no balls');
    return;
  }

  const reply = ballsByUser.map(({ user, balls, dust }) => {
    const { profile: { lvl, class: cls, userName } } = user;
    return [
      `<code>${lvl}</code> ${cls} <b>${userName}</b>`,
      [...balls.map(ballView), dustView(dust)].join(' '),
    ].join(' ');
  });

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function guildGear(ctx) {

  const { session, match } = ctx;

  const [, gearTypeSearch] = match;

  debug('guildGear', gearTypeSearch);

  const gearType = find(GEAR_TYPES, type => lo.startsWith(type, gearTypeSearch));

  const icon = gearType && find(GEAR_ICONS, gearType);

  if (!icon) {
    let replyHelp = [
      `⚠ Invalid gear type <b>${gearTypeSearch}</b>, choose one of:`,
    ];
    if (/help/i.test(gearTypeSearch)) {
      replyHelp = ['📚 To list your team\'s gear please specify:'];
    }
    replyHelp.push('', ...GEAR_TYPES.map(type => `${gearIcon(type, true)}︎ /gg_${type}`));
    await ctx.replyWithHTML(replyHelp.join('\n'));
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

  const reply = matched.length ? matched.join('\n\n') : '⚠ Your team gear is empty, do /authGear';

  await ctx.replyWithHTML(reply);

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

const EVENT_HEAD = /Hat of Pretender/;

function applyEventInfo(gear, profile) {

  const { head } = gear.gearInfo;

  if (!head || !EVENT_HEAD.test(head.name)) {
    return gear;
  }

  return {
    ...gear,
    gearInfo: {
      ...gear.gearInfo,
      head: {
        ...head,
        icon: '🎃',
        streak: profile.event_streak,
      },
    },
  };

}

const BALL_RE = /([^ ]+)[ ]ball/;

function stockBalls(stock) {
  const arr = s.stockArray(stock);
  const ballStock = lo.filter(arr, ({ name }) => name.match(/ball/));
  // debug(ballStock);
  return lo.map(ballStock, ({ name, qty }) => {
    const [, ball] = name.match(BALL_RE);
    return { qty, ball };
  });
}

function ballView({ qty, ball }) {
  return lo.repeat(ball, qty);
}

function dustView(dust) {
  return dust && `✨${numberKM(dust)}`;
}

export async function hat(ctx) {

  const { session, from: { id: fromUserId } } = ctx;

  if (!session.profile) {
    await ctx.replyWithHTML('You need /auth to show your hat');
    return;
  }

  const profile = await a.refreshProfile(fromUserId, session);
  const {
    // event_streak: streak, event_pretended: pretended,
    hp,
    stamina,
  } = profile;

  // if (!streak && !pretended) {
  //   await ctx.replyWithHTML('Buy yourself an event hat');
  // }

  const title = formatProfileTitle(profile).replace(/ gear:/, '');
  // let stats = `🔪${streak} 🤭${pretended} ❤${hp}`;
  let stats;

  const errors = [];

  try {
    const { stock } = await a.stockInfo(fromUserId, session);
    const { '🎃Pumpkin': pump } = stock;
    const potions = s.potionPackInfo(stock);
    const balls = stockBalls(stock);
    const dust = stock[MAGIC_DUST];

    // stats = `${stats}\n🎃${pump || 0} 🍾${p09 || 0} 🎩${hats || 0}`;
    stats = [
      `❤${hp} 🔋${stamina} 🎃${pump || 0}`,
      lo.filter(potions, hatPotions).map(({ icon, qty }) => `${icon} ${qty}`)
        .join(' '),
      lo.filter([...balls.map(ballView), dustView(dust)])
        .join(''),
    ].join('\n');

  } catch (e) {
    if (e.requiredOperation) {
      errors.push('⚠ need /authStock to show pumpkins and potions');
    } else {
      error('hat:stock', e);
    }
  }

  // try {
  //
  //   const gear = await a.gearInfo(fromUserId, session);
  //   const { head = {} } = gear.gearInfo;
  //
  //   const equipped = EVENT_HEAD.test(head.name);
  //
  //   if (!equipped) {
  //     errors.push('⚠ hat is not equipped');
  //   }
  //
  // } catch (e) {
  //   if (e.requiredOperation) {
  //     errors.push('⚠ need /authGear to show if the hat\'s on');
  //   } else {
  //     error('hat:gear', e);
  //   }
  // }

  const reply = [
    `<code>${profile.lvl}</code> ${title}`,
    '',
    stats,
  ];

  if (errors.length) {
    reply.push('', ...errors);
  }

  await ctx.replyWithHTML(reply.join('\n'));

}

function hatPotions({ potionType }) {
  return potionType.match(/rage|peace|morph/i);
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

    const eventUpdatedInfo = applyEventInfo(info, profile);

    await ctx.replyWithHTML([
      formatProfileTitle(profile),
      formatGear(eventUpdatedInfo),
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

function gearIcon(gear, all = false) {
  const item = find(GEAR_ICONS, gear);
  return (item && (item.showIcon || all)) ? item[gear] : '';
}

function gearItem(gear, type) {
  return { type, icon: gearIcon(type), ...gear };
}


function gearItemHtml(gear) {

  const { name, icon, stam } = gear;
  const { atk, def, quality } = gear;
  const { streak } = gear;

  const condition = g.conditionIcon(gear);

  const stats = [
    quality && `(${g.qualityLetter(quality)})`,
    atk && `⚔${atk}`,
    def && `🛡${def}`,
    streak && `🔪${streak}`,
    gear.mana && `💧${gear.mana}`,
    stam && `+${stam}🔋`,
  ];

  return filter([
    icon,
    condition ? `${condition}${/\+/.test(name) ? '' : ' '}${name.replace('⚡', '')}` : name,
    ...stats,
  ]).join(' ');

}
