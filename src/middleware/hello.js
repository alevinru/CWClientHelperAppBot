import { refreshProfile } from '../services/auth';
import { getUsers } from '../services/users';

export async function hello(ctx) {

  const { session, from: { id: userId, first_name: firstName } } = ctx;

  if (!session.auth) {
    ctx.replyPlain([
      'We\'re not familiar yet.',
      ' You should /auth first to start talking.',
    ]);
    return;
  }

  try {

    const profile = await refreshProfile(userId, session);

    session.profile = profile;
    replyResults(profile);

  } catch (e) {
    replyResults(session.profile);
    ctx.replyError('to refresh your profile', e);
  }

  function replyResults(profile) {

    ctx.replyMD([
      `Hi there, *${firstName}*!\n`,
      `Your user id is *${userId}* and ChatWars name *${profile.userName}*`,
    ]);

  }

}


export async function list(ctx) {

  try {

    const users = await getUsers(ctx.session);

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
