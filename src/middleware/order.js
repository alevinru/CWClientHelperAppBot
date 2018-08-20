import * as ordering from '../services/ordering';
import { itemNameByCode } from '../services/cw';

const debug = require('debug')('laa:cwb:wtb');

export async function createOrder(ctx) {

  const {
    match,
    from: { id: userId },
    session: { profile, auth: { token } },
  } = ctx;
  const [, itemCode, quantity, price] = match;
  const command = `/order_${itemCode}_${quantity}_${price}`;

  debug(command);

  if (!profile) {
    ctx.reply('You are not authorized yet, do /auth prior to trading.');
    return;
  }

  const { userName } = profile;

  try {

    // const token = getAuthToken(session);
    // const dealParams = { itemCode, quantity, price };

    const { id } = await ordering.addOrder(userId, itemCode, quantity, price, token);

    const res = [
      `✅ I have added an /order_${id} for <b>${userName}</b>:\n`,
      `to buy <b>${quantity}</b> of <b>${itemNameByCode(itemCode)}</b>`,
      `by max price of <b>${price}</b>💰\n`,
      `so the total sum is <b>${price * quantity}</b>💰.`,
      `\n\nTo remove it issue /rmorder_${id} command.`,
    ];

    await ctx.replyHTML(res.join(' '));

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
      // `To buy <b>${itemNameByCode(order.itemCode)}</b>:`,
      formatOrder(order, true),
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
    ctx.replyHTML(`Order id #<b>${id}</b> removed`);
  } catch (e) {
    ctx.replyError(command, e);
  }

}

function formatOrder(order, withItem = false) {
  const {
    id, userId, qty, price, itemCode,
  } = order;
  // debug('formatOrder', order);
  return [
    `/order_${id} `,
    withItem ? `<b>${itemNameByCode(itemCode)}</b> ` : '',
    `${qty} x ${price}💰 for userId <code>${userId}</code>`,
  ].join('');
}

export async function ordersTop(ctx) {

  const command = '/orders_top';

  debug(command);

  try {

    const res = ['Active orders'];
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
