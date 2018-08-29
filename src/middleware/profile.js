import { refreshProfile } from '../services/auth';
import log from '../services/log';

const { debug } = log('mw:profile');

export default async function (ctx) {

  const { session, from: { id: fromUserId }, message } = ctx;
  const { match } = ctx;
  const [, matchUserId] = match;

  debug(fromUserId, message.text, match);

  try {

    const userId = matchUserId || fromUserId;

    const profile = await refreshProfile(userId, !matchUserId && session);

    ctx.replyJson(profile);

    debug(`GET /profile/${userId}`, profile.userName);

  } catch (e) {
    ctx.replyError('/profile', e);
  }

}
