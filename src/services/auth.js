import filter from 'lodash/filter';
import map from 'lodash/map';
import { cw } from './cw';
import { hsetAsync, hgetallAsync } from './redis';
import { getSession } from './session';
import { BOT_ID } from './bot';

const USERS_HASH = 'users';

export async function getToken(userId) {
  return getSession(BOT_ID, userId)
    .then(getAuthToken);
}

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

  const token = session ? getAuthToken(session) : await getToken(userId);
  const { profile } = await cw.requestProfile(safeUserId(userId), token);

  const teamId = profile.guild_tag || userId.toString();
  const user = { userId, profile, teamId };

  if (session) {
    session.teamId = teamId;
  }

  await hsetAsync(USERS_HASH, userId, JSON.stringify(user));

  return profile;

}

function safeUserId(userId) {
  return parseInt(userId, 0);
}

export async function getUsers(session) {

  const { teamId } = session;

  const users = await hgetallAsync(USERS_HASH)
    .then(res => map(res, JSON.parse));

  return filter(users, user => user.teamId === teamId);

}
