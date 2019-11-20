import { cw } from './cw';
import { hsetAsync, hgetAsync } from './redis';
import { getSession, saveSession } from './session';
import { BOT_ID } from './bot';
// import { USERS_HASH } from './users';
import log from './log';

const { error } = log('auth');

export const USERS_HASH = 'users';

export async function getToken(userId) {
  return getSession(BOT_ID, userId)
    .then(getAuthToken);
}

export async function rmAuth(userId) {
  const session = await getSession(BOT_ID, userId);
  if (!session || !session.auth) {
    return;
  }
  delete session.auth;
  saveSession(BOT_ID, userId, session);
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

export function requestGetUserProfileAuth(userId, token) {
  return cw.authAdditionalOperation(safeUserId(userId), 'GetUserProfile', token);
}

export function requestGuildInfoAuth(userId, token) {
  return cw.authAdditionalOperation(safeUserId(userId), 'GuildInfo', token);
}

export function requestCraftBookAuth(userId, token) {
  return cw.authAdditionalOperation(safeUserId(userId), 'ViewCraftbook', token);
}

export function requestGearInfo(userId, token) {
  return cw.authAdditionalOperation(safeUserId(userId), 'GetGearInfo', token);
}

export function requestStockAccess(userId, token) {
  return cw.authAdditionalOperation(safeUserId(userId), 'GetStock', token);
}

export function requestTradeTerminal(userId, token) {
  return cw.authAdditionalOperation(safeUserId(userId), 'TradeTerminal', token);
}

export function grantGuildInfoAuth(userId, requestId, code, token) {
  return cw.grantAdditionalOperation(safeUserId(userId), requestId, code, token);
}

export function grantCraftBookAuth(userId, requestId, code, token) {
  return cw.grantAdditionalOperation(safeUserId(userId), requestId, code, token);
}

export function grantGearInfoAuth(userId, requestId, code, token) {
  return cw.grantAdditionalOperation(safeUserId(userId), requestId, code, token);
}

export function grantAuth(userId, requestId, code, token) {
  return cw.grantAdditionalOperation(safeUserId(userId), requestId, code, token);
}

export async function guildInfo(userId, session) {

  const token = await tokenByUserIdOrSession(userId, session);

  return cw.guildInfo(userId, token);

}

export async function craftBook(userId, session) {

  const token = await tokenByUserIdOrSession(userId, session);

  return cw.craftBook(userId, token);

}

export async function gearInfo(userId, session) {

  const token = await tokenByUserIdOrSession(userId, session);

  return cw.gearInfo(userId, token);

}

export async function stockInfo(userId, session) {

  const token = await tokenByUserIdOrSession(userId, session);

  return cw.requestStock(safeUserId(userId), token);

}

async function tokenByUserIdOrSession(userId, session) {
  if (session) {
    return getAuthToken(session);
  }
  return getToken(userId);
}

export async function cachedProfile(userId) {
  return hgetAsync(USERS_HASH, userId)
    .then(u => (u ? JSON.parse(u) : {}))
    .then(res => res.profile);
}

export async function refreshProfile(userId, session) {

  let profile = await cachedProfile(userId);

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
    error('refreshProfile', e.message || e);
  }

  if (!profile) {
    throw new Error('Failed to refresh profile');
  }

  return profile;

}

export function safeUserId(userId) {
  return parseInt(userId, 0);
}
