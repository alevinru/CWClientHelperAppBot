import * as ordering from '../services/ordering';
import { itemNameByCode } from '../services/cw';
import { getProfile } from '../services/profile';
import { getAuthToken, getToken } from '../services/auth';

const debug = require('debug')('laa:cwb:wtb');

export async function createOrder(ctx) {

  const {
    match,
    from: { id: userId },
    session,
  } = ctx;
  const [, itemCode, quantity, price, matchUserId] = match;
  const command = `/order_${itemCode}_${quantity}_${price}`;

  debug(command);

  if (!session.profile) {
    ctx.reply('You are not authorized yet, do /auth prior to trading.');
    return;
  }


  try {

    const token = matchUserId ? await getToken(matchUserId) : getAuthToken(session);
    const profile = matchUserId ? await getProfile(matchUserId) : session.profile;

    const { userName } = profile;
    const order = await ordering.addOrder(matchUserId || userId, itemCode, quantity, price, token);

    if (order instanceof Error) {
      ctx.replyError(command, order);
      return;
    }

    const res = [
      `✅ I have added an /order_${order.id} for <b>${userName}</b>:\n`,
      `to buy <b>${quantity}</b> of <b>${itemNameByCode(itemCode)}</b>`,
      `by max price of <b>${price}</b>💰\n`,
      `so the total sum is <b>${price * quantity}</b>💰.`,
      `\n\nTo remove it issue /rmorder_${order.id} command.`,
    ];

    await ctx.replyHTML(res.join(' '));

    await ordering.hookOffers();

  } catch (e) {
    ctx.replyError(command, e);
  }

}


export async function orders(ctx) {

  const {
    match,
  } = ctx;
  const [, itemCode] = match;
  const command = `/orders_${itemCode}`;

  debug(command);

  try {

    const res = [`Active orders for <b>${itemNameByCode(itemCode)}</b>`];
    const items = await ordering.getOrdersByItemCode(itemCode);


    if (!items.length) {
      res.push(' not found.');
    } else {
      res.push('\n');
      res.push(items.map(o => formatOrder(o)).join('\n'));
    }

    ctx.replyHTML(res.join(''));

  } catch (e) {
    ctx.replyError(command, e);
  }

}

export async function orderById(ctx) {

  const {
    match,
  } = ctx;
  const [, id] = match;
  const command = `/order_${id}`;

  debug(command);

  try {
    const order = await ordering.getOrderById(id);
    if (!order) {
      ctx.replyHTML(`No active orders found with id #<b>${id}</b>`);
      return;
    }
    const res = [
      formatOrder(order, true),
      `To remove the order issue /rmorder_${id} command`,
    ];
    ctx.replyHTML(res.join('\n'));
  } catch (e) {
    ctx.replyError(command, e);
  }

}

export async function rmById(ctx) {

  const {
    match,
  } = ctx;
  const [, id] = match;
  const command = `/rmorder_${id}`;

  debug(command);

  try {

    const order = await ordering.removeOrder(id);

    if (!order) {
      ctx.replyHTML(`No active orders found with id #<b>${id}</b>`);
      return;
    }

    ctx.replyHTML(`Order #<b>${id}</b> removed`);

    await ordering.hookOffers();

  } catch (e) {
    ctx.replyError(command, e);
  }

}

function formatOrder(order, withItem = false) {
  const {
    id, userId, qty, price, itemCode, userName,
  } = order;
  // debug('formatOrder', order);
  return [
    `/order_${id} `,
    withItem ? `<b>${itemNameByCode(itemCode)}</b> ` : '',
    `${qty} x ${price}💰 for `,
    userName ? `<b>${userName}</b>` : `userId <code>${userId}</code>`,
  ].join('');
}

export async function ordersTop(ctx) {

  const command = '/orders_top';

  debug(command);

  try {

    const res = new Array('Active orders');
    const items = await ordering.getTopOrders();

    if (!items.length) {
      res.push(' not found.');
    } else {
      res.push(' so far:\n');
      res.push(items.map(o => formatOrder(o, true)).join('\n'));
    }

    ctx.replyHTML(res.join(''));

  } catch (e) {
    debug(e);
    ctx.replyError(command, e);
  }

}
