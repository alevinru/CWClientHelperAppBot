import { cw } from './cw';
import { hsetAsync, hgetAsync } from './redis';
import { getSession } from './session';
import { BOT_ID } from './bot';
import { USERS_HASH } from './users';

const debug = require('debug')('laa:cwb:auth');

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

  let profile;

  try {
    profile = await hgetAsync(USERS_HASH, userId)
      .then(JSON.parse)
      .then(res => res.profile);
  } catch (e) {
    throw e;
  }

  try {

    const token = session ? getAuthToken(session) : await getToken(userId);
    const { profile: freshProfile } = await cw.requestProfile(safeUserId(userId), token);

    if (freshProfile) {

      profile = freshProfile;

      const teamId = profile.guild_tag || userId.toString();
      const user = { userId, profile, teamId };

      if (session) {
        session.teamId = teamId;
      }

      await hsetAsync(USERS_HASH, userId, JSON.stringify(user));

    }

  } catch (e) {
    debug('refreshProfile', e.message || e);
  }

  return profile;

}

function safeUserId(userId) {
  return parseInt(userId, 0);
}
