import { refreshProfile, getAuthToken } from '../services/auth';
import { getToken } from '../services/profile';

const debug = require('debug')('laa:cwb:profile');

export default async function (ctx) {

  const { session, from: { id: userId }, message } = ctx;
  const { match } = ctx;
  const [, matchUserId] = match;

  debug(userId, message.text, match);

  try {

    const token = matchUserId ? await getToken(matchUserId) : getAuthToken(session);
    const profile = await refreshProfile(matchUserId || userId, token);

    ctx.replyJson(profile);

    debug(`GET /profile/${userId}`, profile.userName);

  } catch (e) {
    ctx.replyError('/profile', e);
  }

}
