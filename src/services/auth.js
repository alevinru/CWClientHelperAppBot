import { cw } from './cw';
import { hsetAsync } from './redis';

const USERS_HASH = 'users';

export function getAuthToken(session) {
  try {
    const { auth: { token } } = session;
    return token;
  } catch (e) {
    throw new Error('Not authorized');
  }
}

export function setAuth(session, authData) {
  session.auth = authData;
}

export function requestToken(userId, code) {
  return cw.sendGrantToken(safeUserId(userId), code);
}

export function requestAuth(userId) {
  return cw.sendAuth(safeUserId(userId));
}

export async function refreshProfile(userId, session) {

  const { profile } = await cw.requestProfile(safeUserId(userId), getAuthToken(session));

  await hsetAsync(USERS_HASH, userId, JSON.stringify({ userId, profile }));

  return profile;

}

function safeUserId(userId) {
  return parseInt(userId, 0);
}
