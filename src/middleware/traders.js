// import { itemNameByCode } from "../services/cw";
import * as trading from '../services/trading';

const debug = require('debug')('laa:cwb:traders');

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

function formatTrader({ id, profile }) {
  return `<code>${id}</code> <b>${profile.userName}</b>`;
}
