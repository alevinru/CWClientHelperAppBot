import { cw } from '../services/cw';

const debug = require('debug')('laa:cwb:profile');

export default async function ({ reply, from: { id: userId } }) {

  debug(userId);

  try {
    const profile = await cw.requestProfile(userId);
    reply(profile);
    debug(`GET /profile/${userId}`, Object.keys(profile));
  } catch (e) {
    reply(`Tried requestProfile, but got "${e}" exception`);
    throw new Error(e);
  }

}
