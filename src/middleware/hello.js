import { refreshProfile } from '../services/auth';
import { getAuthorizedUsers } from '../services/users';
import { BOT_ID } from '../services/bot';
import { getSession } from '../services/session';

export async function hello(ctx) {

  const {
    session,
    from: { id: fromUserId, first_name: firstName },
    match,
  } = ctx;

  const [, matchUserId] = match;

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
        'There\'s no users for your session.',
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
