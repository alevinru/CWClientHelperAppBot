import { cw, getAuthToken } from '../services';

const debug = require('debug')('laa:cwb:profile');

export default async function (ctx) {

  const { session, from: { id: userId } } = ctx;
  debug(userId);

  try {
    const token = getAuthToken(session);
    const profile = await cw.requestProfile(parseInt(userId, 0), token);
    ctx.replyJson(profile);
    debug(`GET /profile/${userId}`, Object.keys(profile));
  } catch (e) {
    ctx.replyError('/profile', e);
  }

}
