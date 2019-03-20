import * as trading from '../services/trading';
import log from '../services/log';
import { userOrderList } from './order';
import { hookOffers } from '../services/ordering';
// import { getAuthorizedUsers } from '../services/users';
// import { dropOfferHooks, getOfferHooks } from "../consumers/offersConsumer";

const { debug } = log('mw:traders');

const ADMIN_ID = parseInt(process.env.ADMIN_ID, 0);

export async function tradingStatus(ctx) {

  const command = '/trading';

  debug(command);

  try {

    const userId = ctx.from.id;

    let trader = trading.getCachedTrader(userId);

    if (!trader) {
      ctx.replyHTML(replyNotAuthorized());
      return;
    }

    trader = await trading.refreshTraderCache(userId);

    const { funds, profile, isPaused } = trader;
    const { userName } = profile;

    const reply = [
      isPaused ? '⏸' : '✅',
      ` <b>${userName}</b> has ${funds || 'no '}💰 to trade by the orders:`,
      '\n\n',
    ];

    const orders = await userOrderList(userId);

    if (orders.length) {
      reply.push(...orders);
    } else {
      reply.push(orders);
    }

    reply.push(`\n\nIssue /trading_${isPaused ? 'on' : 'off'}`);
    reply.push(` to ${isPaused ? 'continue' : 'pause'} trading`);

    await ctx.replyHTML(reply);

  } catch (e) {
    ctx.replyError(command, e);
  }

}

export async function traders(ctx) {

  const command = '/traders';

  const { from: { id: sessionUserId } } = ctx;

  debug(command);

  try {

    const res = new Array('Traders');

    if (sessionUserId !== ADMIN_ID) {
      await ctx.reply('You have no permission to list traders');
      return;
    }

    const items = await trading.getTraders();

    if (!items.length) {
      res.push(' not found.');
      res.push('\nIssue /grant_trading <code>userId</code> to add a trader');
    } else {
      res.push(':\n');
      res.push(items.map(o => formatTrader(o)).join('\n'));
    }

    ctx.replyHTML(res.join(''));

  } catch (e) {
    ctx.replyError(command, e);
  }

}


export async function grantTrading(ctx) {

  const { match, from: { id: sessionUserId } } = ctx;

  const [, userId, priority = 0] = match;

  const command = `/grant_trading ${userId} ${priority}`;

  debug(command);

  if (sessionUserId !== ADMIN_ID) {
    debug('permission error', sessionUserId, ADMIN_ID);
    ctx.replyError('/grant_trading', 'You have no permission to grant trading');
    return;
  }

  try {

    const trader = await trading.grantTrading(userId, priority);

    ctx.replyHTML(`Trading granted to:\n${formatTrader(trader)}`);

  } catch (e) {
    await ctx.replyError(command, e);
  }

}

function formatTrader(trader) {

  const {
    id,
    profile,
    funds,
    isPaused = false,
    priority = 0,
  } = trader;

  return [
    isPaused ? '⏸' : '✅',
    `<code>${id}</code> <b>${profile.userName}</b> ${funds}💰`,
    `priority: <code>${priority}</code>`,
  ].join(' ');

}


function replyNotAuthorized() {
  return [
    'You are not authorized for trading\n',
    'Try /request_trading',
    ' followed by some words you might want to say to the admin',
  ];
}

export async function tradingActive(ctx) {

  const {
    from: { id: userId },
    match,
  } = ctx;
  const [, onOff] = match;
  const command = `/trading_${onOff}`;

  debug(command);

  try {

    switch (onOff) {
      case 'on':
        await trading.setTraderActive(userId, true);
        await ctx.replyHTML('Trading started, issue /trading_off to pause');
        break;
      case 'off':
        await trading.setTraderActive(userId, false);
        await ctx.replyHTML('Trading paused, issue /trading_on to continue');
        break;
      default:
        await ctx.replyHTML('Unknown trading parameter');
        return;
    }

    await hookOffers();

  } catch (e) {
    ctx.replyError(command, e);
  }

}
