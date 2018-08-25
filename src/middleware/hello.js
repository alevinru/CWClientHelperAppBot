import { refreshProfile } from '../services/auth';

export default async function (ctx) {

  const { session, reply, from: { id: userId, first_name: firstName } } = ctx;

  if (!session.auth) {
    reply('We\'re not familiar yet. You should /auth first to start talking.');
    return;
  }

  try {

    const { profile } = await refreshProfile(userId, session);

    session.profile = profile;
    replyResults(profile);

  } catch (e) {
    replyResults(session.profile);
    ctx.replyError('to refresh your profile', e);
  }

  function replyResults(profile) {

    ctx.replyMD([
      `Hi there, *${firstName}*!\n`,
      `Your user id is *${userId}* and CatWars name *${profile.userName}*`,
    ]);

  }

}
