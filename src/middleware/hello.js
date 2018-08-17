import { cw, getAuthToken } from '../services';


export default async function (ctx) {

  const { session, reply, from: { id: userId, first_name: firstName } } = ctx;

  if (!session.auth) {
    reply('We\'re not familiar yet. You should /auth first to start talking.');
    return;
  }

  try {
    const { profile } = await cw.requestProfile(userId, getAuthToken(session));
    session.profile = profile;
    const msg = `Hi there, *${firstName}*! Your user id is *${userId}* and CW name *${profile.userName}*`;
    reply(msg, { parse_mode: 'Markdown' });
  } catch (e) {
    ctx.replyError('requestProfile', e);
  }

}
