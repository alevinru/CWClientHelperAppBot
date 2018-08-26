import * as trading from '../services/trading';
import { userOrderList } from './order';

const debug = require('debug')('laa:cwb:traders');


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

    const { funds, profile } = trader;
    const { userName, class: cls, castle } = profile;

    const reply = [
      `<b>${userName}</b> is ${cls} from ${castle} with ${funds}💰`,
      '\n',
    ];

    const orders = await userOrderList(userId);

    if (orders.length) {
      reply.push(...orders);
    } else {
      reply.push(orders);
    }

    await ctx.replyHTML(reply);

  } catch (e) {
    ctx.replyError(command, e);
  }

}

export async function traders(ctx) {

  const command = '/traders';

  debug(command);

  try {

    const res = new Array('Traders');
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

  const { match } = ctx;

  const [, userId] = match;

  const command = `/grant_trading ${userId}`;

  debug(command);

  try {

    const trader = await trading.grantTrading(userId);

    ctx.replyHTML(`Trading granted to:\n${formatTrader(trader)}`);

  } catch (e) {
    ctx.replyError(command, e);
  }

}

function formatTrader({ id, profile, funds }) {
  return `<code>${id}</code> <b>${profile.userName}</b> ${funds}💰`;
}


function replyNotAuthorized() {
  return [
    'You are not authorized for trading\n',
    'Try /request_trading',
    ' followed by some words you might want to say to the admin',
  ];
}
