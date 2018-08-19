import * as ordering from '../services/ordering';
import { itemNameByCode } from '../services/cw';

const debug = require('debug')('laa:cwb:wtb');

export default async function (ctx) {

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
      `✅ I have added an order id <b>${id}</b> for <b>${userName}</b>:\n`,
      `to buy <b>${quantity}</b> of <b>${itemNameByCode(itemCode)}</b>`,
      `by max price of <b>${price}</b>💰\n`,
      `and the total sum is <b>${price * quantity}</b>💰`,
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
    const items = await ordering.getOrdersByItemCode(itemCode);
    const res = items.map(formatOrder);
    if (!res.length) {
      res.push(`No active orders found for <b>${itemNameByCode(itemCode)}</b>`);
    }
    ctx.replyHTML(res.join('\n'));
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
      `To buy <b>${itemNameByCode(order.itemCode)}</b>:`,
      formatOrder(order),
    ];
    ctx.replyHTML(res.join('\n'));
  } catch (e) {
    ctx.replyError(command, e);
  }

}

function formatOrder(order) {
  const {
    id, userId, qty, price,
  } = order;
  return `#${id} : ${userId} ${qty} x ${price}💰`;
}
