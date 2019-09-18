import * as trading from '../services/trading';
import log from '../services/log';
import { hookOffers, getOrdersByUserId } from '../services/ordering';
// import { getAuthorizedUsers } from '../services/users';
// import { dropOfferHooks, getOfferHooks } from "../consumers/offersConsumer";

const { debug } = log('mw:traders');

const ADMIN_ID = parseInt(process.env.ADMIN_ID, 0);
const ADMIN_PRIORITY = parseInt(process.env.ADMIN_PRIORITY, 0) || 10;

export async function tradingHelp(ctx) {
  await ctx.replyWithHTML(helpReply());
}

export async function tradingStatus(ctx) {

  const command = '/trading';

  debug(command);

  try {

    const userId = ctx.from.id;

    let trader = trading.getCachedTrader(userId);

    if (!trader) {
      await ctx.replyWithHTML(helpReply());
      return;
    }

    trader = await trading.refreshTraderCache(userId);

    const { funds, profile, isPaused } = trader;
    const { userName } = profile;

    const reply = [
      isPaused ? '⏸' : '✅',
      ` <b>${userName}</b> has ${funds || 'no '}💰`,
      '\n\n',
    ];

    const orders = await getOrdersByUserId(userId);

    if (orders.length) {
      reply.push(`and has <b>${orders.length}</b> /orders`);
    } else {
      reply.push('and has no /orders');
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

    const trader = trading.getCachedTrader(sessionUserId);

    if (!(trader && trader.priority)) {
      return;
    }

    if (sessionUserId !== ADMIN_ID && trader.priority < ADMIN_PRIORITY) {
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


function helpReply() {
  return [
    '<b>Trading</b>',
    '',
    ['For a start try /t_01 for Thread market statistics tof the past day.',
      'Use /t01_8 and /t01_20m to narrow the time range'].join(' '),
    '',
    ['Use <code>/wtb_{itemCode}_{qty}_{price}</code> for exact price requests.',
      'For example /wtb_01_1_8 will try to buy 1 thread for 8 gold <b>exactly</b>'].join(' '),
    '',
    'Underscore symbols _ could be substituted with spaces like <code>/t 01 2</code>',
    '',
    ['/who_07_1_20m shows top powder <b>buyers</b> over the last 20 minutes.',
      'While /whos_07_1_24 shows top powder <b>sellers</b> of the past day'].join(' '),
  ].join('\n');
}

export async function tradingActive(ctx) {

  const {
    from: { id: fromUserId },
    match,
  } = ctx;
  const [, onOff, matchUserId] = match;
  const command = `/trading_${onOff}`;

  debug(command, matchUserId);

  if (fromUserId !== ADMIN_ID && matchUserId) {
    return;
  }

  const userId = matchUserId ? parseInt(matchUserId, 0) : fromUserId;

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
