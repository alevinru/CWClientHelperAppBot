import get from 'lodash/get';
import orderBy from 'lodash/orderBy';
import filter from 'lodash/filter';
import sumBy from 'lodash/sumBy';
import chunk from 'lodash/chunk';
import { eachSeriesAsync } from 'sistemium-telegram/services/async';

import { refreshProfile } from '../services/auth';
import {
  saveUser, getAuthorizedUsers, saveTrust, freshProfiles,
  guildUsers, userSetting, NOTIFY_FOR_MOBS,
} from '../services/users';
import { BOT_ID } from '../services/bot';
import { getSession } from '../services/session';

import log from '../services/log';
import * as p from '../services/profile';
import User from '../models/User';
import Chat, { CHAT_SETTING_HELPERS_MIN_HP } from '../models/Chat';

const { debug } = log('mw:hello');

const SERVERS = new Map([
  ['408101137', 'EU'],
  ['265204902', 'CW3'],
]);

const SERVER_NAME = SERVERS.get(process.env.CW_BOT_ID);

export async function hello(ctx) {

  const {
    session,
    from: { id: fromUserId, first_name: firstName },
    match,
  } = ctx;

  const [, matchUserId] = match || [];

  if (!session.auth) {
    ctx.replyPlain([
      'We\'re not familiar yet.',
      ' You should /auth first to start talking.',
    ]);
    return;
  }

  // if (!session.admin)

  try {

    const userId = matchUserId || fromUserId;
    const userSession = matchUserId ? await getSession(BOT_ID, userId) : session;

    const profile = await refreshProfile(userId, userSession);

    if (!matchUserId) {
      session.profile = profile;
    }

    const saved = await saveUser(ctx.from, profile);

    debug('saved', saved);

    replyResults(profile, userId);

  } catch (e) {
    if (!matchUserId && session.profile) {
      replyResults(session.profile, fromUserId);
    }
    ctx.replyError('to refresh your profile', e);
  }

  function replyResults(profile, userId) {

    ctx.replyMD([
      `Hi there, *${firstName}*!\n`,
      `Your user id is *${userId}* and ChatWars name *${profile.userName}*`,
    ]);

  }

}

export async function castles(ctx) {

  const reply = await profileStats('castle', 'castles');

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function classes(ctx) {

  const reply = await profileStats('class', 'classes');

  await ctx.replyWithHTML(reply.join('\n'));

}


async function profileStats(prop, cmd) {

  const pipeline = [
    { $match: { profile: { $ne: null } } },
    { $group: { _id: `$profile.${prop}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ];

  const data = await User.aggregate(pipeline);

  return [
    `<b>${SERVER_NAME}</b> bot users by /${cmd}`,
    '',
    ...data.map(item => {
      const { _id: castle, count } = item;
      return `${castle} ${count}`;
    }),
    '',
    `Total <b>${sumBy(data, 'count')}</b>`,
  ];

}

export async function usersToPin(ctx) {

  const { session: { profile }, match } = ctx;

  if (!profile) {
    await ctx.replyWithHTML('Not authorized');
    return;
  }

  const { guild_tag: tag } = profile;

  if (!tag) {
    await ctx.replyWithHTML('You are not a guild member');
    return;
  }

  const [, levelParam, silent] = match;
  const replyOptions = { disable_notification: !!silent };
  const minLevel = parseInt(levelParam, 0);
  const minHp = await Chat.findValue(ctx.chat.id, CHAT_SETTING_HELPERS_MIN_HP) || 900;

  const data = await guildUsersWithHp(tag, minLevel, minHp);

  const reply = filter(data.map(player => {
    const { class: cls, lvl, hp } = player;
    const pin = userSetting(player, NOTIFY_FOR_MOBS);
    const username = `@${player.tgUsername}`;
    return pin && [
      cls,
      `<code>${lvl}</code>`,
      `❤${hp}`,
      silent ? `<code>${username}</code>` : username,
    ].join(' ');
  }));

  if (!reply.length) {
    const noData = [
      `No helpers with <b>${minHp}</b> hp`,
      levelParam ? ` and level less or equal than <b>${levelParam}</b>` : '',
    ];
    await ctx.replyWithHTML(noData.join(''));
    return;
  }

  await eachSeriesAsync(chunk(reply, 4), async replyChunk => {
    await ctx.replyWithHTML(replyChunk.join('\n'), replyOptions);
    await new Promise(resolve => setTimeout(resolve, 500));
  });

}

async function guildUsersWithHp(tag, maxLevel, minHp = 900) {

  const users = await guildUsers(tag);

  const fresh = await freshProfiles(users);

  return filter(fresh, profile => {
    const { lvl, hp, stamina } = profile;
    return (lvl <= maxLevel || !maxLevel) && hp >= minHp && stamina > 0;
  });

}

export async function guildHp(ctx) {

  const [, prop, limit, kilos] = ctx.match || [];

  if (!prop) {
    await ctx.replyWithHTML(`Invalid profile property <code>${prop}</code>`);
    return;
  }

  const icon = p.propIcon(prop);
  const minValue = parseInt(limit || '1', 0) * (kilos ? 1000 : 1);

  if (!icon) {
    return;
  }

  const users = await getAuthorizedUsers(ctx.session);

  debug('guildHp:users', users.length, prop, minValue);

  const profiles = filter(await freshProfiles(users), profile => {
    const { [prop]: value } = profile;
    return value >= minValue;
  });

  debug('guildHp:profiles', profiles.length);

  const reply = orderBy(profiles, [prop, 'userName'], ['desc', 'asc'])
    .map(formatUserHp);

  if (!reply.length) {
    await ctx.replyWithHTML(`No guild mates with <b>${prop}</b> >= <b>${minValue}</b>`);
    return;
  }

  await ctx.replyWithHTML(reply.join('\n'));

  function formatUserHp(profile) {
    const {
      userName,
      class: cls,
      lvl,
      [prop]: value,
    } = profile;
    return `${cls} <code>${lvl}</code> ${userName} ${icon} ${p.expView(value)}`;
  }

}

export async function listUsers(ctx) {

  const cmd = ctx.match[0] === '/gg' ? 'gear' : 'profile';

  try {

    const users = await getAuthorizedUsers(ctx.session);

    if (users.length) {
      const sorted = orderBy(users, ({ profile: { userName } }) => userName.toLowerCase());
      await ctx.replyHTML(sorted.map(formatUser(cmd)).join('\n'));
    } else {
      await ctx.replyHTML([
        'There are no users for your session.',
        ' Try /hello to update your profile',
      ]);
    }

  } catch (e) {
    ctx.replyError('to list users', e);
  }

}


function formatUser(cmd) {
  return ({ id: userId, profile: { userName, class: cls, lvl } }) => {
    return `${cls} <code>${lvl}</code> /${cmd}_${userId} <b>${userName}</b>`;
  };
}


export async function trust(ctx) {

  const {
    from: { id: fromUserId },
    message: { reply_to_message: reply, text },
  } = ctx;

  const replyUserId = reply && reply.from.id;

  debug('trust', fromUserId, replyUserId);

  if (!reply) {
    await ctx.replyWithHTML('Reply to any user\'s message to set or break up a trust');
    return;
  }

  const replyName = `<code>@${reply.from.username}</code>`;

  const user = await User.findOne({ id: fromUserId });

  if (!user) {
    await ctx.replyWithHTML('You are not a user of mine, try /hello to update your data');
    return;
  }

  if (reply.from.is_bot) {
    await ctx.replyWithHTML(`${replyName} is a bot, one can not trust to bots.`);
    return;
  }

  debug('trust:trusts', user.trusts);

  let finalReply;

  if (text === '/trust') {

    if (get(user.trusts, replyUserId)) {
      await ctx.replyWithHTML(`You do trust <code>@${reply.from.username}</code> already`);
      return;
    }

    await saveTrust(fromUserId, replyUserId);

    finalReply = [
      `You now trust <code>@${reply.from.username}</code> to view your stock and profile.`,
      'To break trust relationships reply any of it\'s messages with /untrust',
    ];

  } else {

    if (!get(user.trusts, replyUserId)) {
      await ctx.replyWithHTML(`You do not trust <code>@${reply.from.username}</code>`);
      return;
    }

    await saveTrust(fromUserId, replyUserId, false);

    finalReply = [
      `You've broken up a trust with <code>@${reply.from.username}</code>`,
    ];

  }

  await ctx.replyWithHTML(finalReply.join('\n'));

}
