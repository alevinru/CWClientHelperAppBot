import find from 'lodash/find';
import * as a from '../services/auth';
import { hello } from './hello';
import log from '../services/log';

const { debug } = log('mw:auth');

export async function auth(ctx) {

  const { reply, from: { id: userId } } = ctx;

  debug('auth:', userId);

  try {
    await a.requestAuth(userId);
    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward this message here to complete authorization',
    ];
    reply(msg.join(' '));
  } catch (e) {
    ctx.replyError('to send auth code', e);
  }

}

export async function authGetProfile(ctx) {

  const { from: { id: userId }, session } = ctx;

  debug('authGetProfile:', userId);

  try {

    const token = a.getAuthToken(session);

    const { uuid } = await a.requestGetUserProfileAuth(userId, token);

    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward this message back to complete <b>Get User Profile</b> authorization',
    ];

    session.authGetUserProfileId = uuid;

    await ctx.replyHTML(msg.join(' '));

  } catch (e) {
    await ctx.replyError('to send auth code', e);
  }

}


export async function authGuildInfo(ctx) {

  const { from: { id: userId }, session } = ctx;

  debug('authGuildInfo:', userId);

  try {

    const token = a.getAuthToken(session);

    const { uuid } = await a.requestGuildInfoAuth(userId, token);

    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward this message back to complete <b>Guild Info</b> authorization',
    ];

    session.authGuildInfoId = uuid;

    await ctx.replyHTML(msg.join(' '));

  } catch (e) {
    await ctx.replyError('to send auth code', e);
  }

}

export async function authCraftBook(ctx) {

  const { from: { id: userId }, session } = ctx;

  debug('authCraftBook:', userId);

  try {

    const token = a.getAuthToken(session);

    const { uuid } = await a.requestCraftBookAuth(userId, token);

    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward that message here to complete <b>Craft Book</b> authorization',
    ];

    session.authCraftBookId = uuid;

    await ctx.replyHTML(msg.join(' '));

  } catch (e) {
    await ctx.replyError('to send auth code', e);
  }

}

export async function authGearInfo(ctx) {

  const { from: { id: userId }, session } = ctx;

  debug('authCraftBook:', userId);

  try {

    const token = a.getAuthToken(session);

    const { uuid } = await a.requestGearInfo(userId, token);

    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward that message here to complete <b>Gear Info</b> authorization',
    ];

    session.authGearInfoId = uuid;

    await ctx.replyHTML(msg.join(' '));

  } catch (e) {
    await ctx.replyError('to send auth code', e);
  }

}

export async function authStock(ctx) {

  const { from: { id: userId }, session } = ctx;

  debug('authStock:', userId);

  try {

    const token = a.getAuthToken(session);

    const { uuid } = await a.requestStockAccess(userId, token);

    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward that message here to complete <b>Stock Info</b> authorization',
    ];

    session.authStockAccessId = uuid;

    await ctx.replyHTML(msg.join(' '));

  } catch (e) {
    await ctx.replyError('to send auth code', e);
  }

}

export async function authBuy(ctx) {

  const { from: { id: userId }, session } = ctx;

  debug('authBuy:', userId);

  try {

    const token = a.getAuthToken(session);

    const { uuid } = await a.requestTradeTerminal(userId, token);

    const msg = [
      `Auth code has been sent to your telegram account number ${userId}.`,
      'Please forward that message here to complete <b>Trade Terminal</b> authorization',
    ];

    session.authBuyId = uuid;

    await ctx.replyHTML(msg.join(' '));

  } catch (e) {
    await ctx.replyError('to send auth code', e);
  }

}


const { CW_APP_NAME } = process.env;

const AUTH_CODE_RE = new RegExp(`^Code (\\d+) to authorize ${CW_APP_NAME}`);

export async function authCode(ctx, next) {

  const {
    session,
    message: { entities, text },
    from: { id: userId },
  } = ctx;

  if (!AUTH_CODE_RE.test(text)) {
    await next();
    return;
  }

  const codeEntity = find(entities, { type: 'code' });

  if (!codeEntity) {
    await next();
    return;
  }

  const { offset, length } = codeEntity;
  const code = text.substr(offset, length);

  try {

    const { authGuildInfoId } = session;
    const { authGearInfoId, authGetUserProfileId } = session;
    const { authCraftBookId } = session;
    const { authStockAccessId, authBuyId } = session;

    if (authBuyId && text.match(/issue a wtb\/wts\/rm/)) {
      const token = a.getAuthToken(session);

      debug('authBuy code:', code, token, authBuyId);
      await a.grantAuth(userId, authBuyId, code, token);
      delete session.authBuyId;
      session.isBuyAuthorized = true;
      await ctx.replyHTML([
        '✅ Congratulations, wtb authorization complete!\n',
        'Try /wtb_01_1_1 command.',
      ]);

    } else if (authGetUserProfileId && text.match(/read your profile/)) {
      const token = a.getAuthToken(session);

      debug('authGetUserProfileId code:', code, token, authGetUserProfileId);
      await a.grantAuth(userId, authGetUserProfileId, code, token);
      delete session.authGetUserProfileId;
      session.isGetUserProfileAuthorized = true;
      await hello(ctx);
      await ctx.replyHTML([
        '✅ Congratulations, profile info authorization complete!\n',
        'Try /profile command.',
      ]);

    } else if (authStockAccessId && text.match(/read your stock/)) {
      const token = a.getAuthToken(session);

      debug('stockAccess code:', code, token, authStockAccessId);
      await a.grantAuth(userId, authStockAccessId, code, token);
      delete session.authStockAccessId;
      session.isStockAccessAuthorized = true;
      await ctx.replyHTML([
        '✅ Congratulations, stock info authorization complete!\n',
        'Try /stock command.',
      ]);

    } else if (authGearInfoId && text.match(/view currently equipped gear/)) {

      const token = a.getAuthToken(session);

      debug('guildInfo code:', code, token, authGearInfoId);

      if (!authGearInfoId) {
        await ctx.replyHTML(`GearInfo auth is not requested for userId ${userId}`);
      } else {
        await a.grantGearInfoAuth(userId, authGearInfoId, code, token);
        delete session.authGearInfoId;
        session.isGearInfoAuthorized = true;
        await ctx.replyHTML([
          '✅ Congratulations, gear info authorization complete!\n',
          'Try /gear command.',
        ]);
      }

    } else if (authGuildInfoId && text.match(/to read your guild info/)) {

      const token = a.getAuthToken(session);

      debug('guildInfo code:', code, token, authGuildInfoId);

      if (!authGuildInfoId) {
        await ctx.replyHTML(`GuildInfo auth is not requested for userId ${userId}`);
      } else {
        await a.grantGuildInfoAuth(userId, authGuildInfoId, code, token);
        delete session.authGuildInfoId;
        session.isGuildInfoAuthorized = true;
        await ctx.replyHTML([
          '✅ Congratulations, guildInfo authorization complete!\n',
          'Try /gi {filter} command.',
        ]);
      }

    } else if (authCraftBookId && text.match(/to view your craft or alchemists book/)) {

      const token = a.getAuthToken(session);

      debug('craftBook code:', code, token, authCraftBookId);

      if (!authCraftBookId) {
        await ctx.replyHTML(`CraftBook auth is not requested for userId ${userId}`);
      } else {
        await a.grantCraftBookAuth(userId, authCraftBookId, code, token);
        delete session.authCraftBookId;
        session.isCraftBookAuthorized = true;
        await ctx.replyHTML([
          '✅ Congratulations, CraftBook authorization complete!\n',
          'Try /cb command.',
        ]);
      }

    } else {

      const token = await a.requestToken(userId, code);
      debug('token:', token);
      a.setAuth(session, token);

      ctx.replyPlain([
        '✅ Congratulations, authorization complete!\n',
        'Try /profile and /stock commands.',
      ]);

      await hello(ctx);

    }

  } catch (e) {
    ctx.replyError('to complete authorization', e);
  }

}
