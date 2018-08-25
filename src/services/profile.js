import { BOT_ID } from './bot';
import { getSession } from './session';

// eslint-disable-next-line
export async function getProfile(userId) {
  return getSession(BOT_ID, userId)
    .then(res => res.profile);
}
