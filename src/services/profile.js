import { BOT_ID } from './bot';
import { sessionKey } from './session';
import { getAsync } from './redis';

// eslint-disable-next-line
export async function getProfile(userId) {
  return getAsync(sessionKey(BOT_ID, userId))
    .then(res => JSON.parse(res).profile);
}
