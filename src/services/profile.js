import { BOT_ID } from './bot';
import { getSession } from './session';
import { getAuthToken } from './auth';

// eslint-disable-next-line
export async function getProfile(userId) {
  return getSession(BOT_ID, userId)
    .then(res => res.profile);
}

export async function getToken(userId) {
  return getSession(BOT_ID, userId)
    .then(res => getAuthToken(res));
}
