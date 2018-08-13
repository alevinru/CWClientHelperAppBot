import { cw } from '../services/cw';
import { getAuthToken } from '../services/auth';

const debug = require('debug')('laa:cwb:profile');

export default async function ({ session, reply, from: { id: userId } }) {

  debug(userId);

  try {
    const token = getAuthToken(session);
    const profile = await cw.requestProfile(parseInt(userId, 0), token);
    reply(profile);
    debug(`GET /profile/${userId}`, Object.keys(profile));
  } catch (e) {
    reply(`Tried "requestProfile", but got ${e.toString()} exception`);
    throw new Error(e);
  }

}
