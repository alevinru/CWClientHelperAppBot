import get from 'lodash/get';

import { refreshProfile } from '../services/auth';
import { saveUser, getAuthorizedUsers, saveTrust } from '../services/users';
import { BOT_ID } from '../services/bot';
import { getSession } from '../services/session';

import log from '../services/log';
import User from '../models/User';

const { debug } = log('mw:hello');

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


export async function listUsers(ctx) {

  try {

    const users = await getAuthorizedUsers(ctx.session);

    if (users.length) {
      await ctx.replyHTML(users.map(formatUser).join('\n'));
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


function formatUser({ userId, profile, teamId }) {
  return `/profile_${userId} <b>${profile.userName}</b> from <b>${teamId}</b>`;
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
