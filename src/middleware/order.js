import fpMap from 'lodash/fp/map';
import filter from 'lodash/filter';

import { getCachedTrader } from '../services/trading';
import * as ordering from '../services/ordering';
import { itemNameByCode } from '../services/cw';
import { getProfile } from '../services/profile';
import { getAuthToken, getToken } from '../services/auth';
import log from '../services/log';

const { debug, error } = log('mw:order');

export async function checkTraderAuth(ctx, next) {

  const {
    from: { id: userId },
  } = ctx;

  const trader = getCachedTrader(userId);

  if (!trader || !trader.priority) {
    debug('unauthorized access', userId);
    return;
  }

  await next();

}

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
      order.isActive ? '✅' : '⏸',
      `I have added an /order_${order.id} for <b>${userName}</b>:\n`,
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
      res.push('\n\n');
      res.push(items.map(o => formatOrder(o, { withUser: true })).join('\n'));
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
      formatOrder(order, { withItem: true, list: true }),
      `/orders_${order.itemCode} or /rmorder_${id} to delete`,
    ];

    if (!order.isActive) {
      res.push(`/saorder_${id} to set active`);
    }

    await ctx.replyHTML(res.join('\n'));

  } catch (e) {
    await ctx.replyError(command, e);
  }

}

export async function setOrderActive(ctx) {

  const { match } = ctx;
  const [, id] = match;
  const command = `/saorder_${id}`;

  try {

    let order = await ordering.getOrderById(id);

    if (!id) {
      await ctx.replyWithHTML(`Not found order with id ${id}`);
      return;
    }

    const { userId, itemCode } = order;

    debug('setOrderActive:', userId, itemCode);

    await ordering.setOrderTop(id, userId, itemCode);

    order = await ordering.getOrderById(id);

    await ordering.hookOffers();

    await ctx.replyWithHTML(formatOrder(order, { withUser: true }));

  } catch (e) {
    ctx.replyError(command, e);
  }

}

export async function rmById(ctx) {

  const {
    match,
    from: { id: sessionUserId },
  } = ctx;
  const [, id] = match;
  const command = `/rmorder_${id}`;

  debug(command);

  try {

    const order = await ordering.getOrderById(id);

    if (!order) {
      await ctx.replyHTML(`No active orders found with id #<b>${id}</b>`);
      return;
    }

    const { userId: authorId } = order;

    if (sessionUserId !== authorId) {
      const { priority: orderPriority = 0 } = getCachedTrader(authorId) || {};
      const { priority: ownPriority = 0 } = getCachedTrader(sessionUserId) || {};

      if (ownPriority < orderPriority) {
        await ctx.reply('You have no permission to remove this order');
        return;
      }
    }

    await ordering.removeOrder(id);

    ctx.replyHTML(`Order #<b>${id}</b> removed`);

    await ordering.hookOffers();

  } catch (e) {
    ctx.replyError(command, e);
  }

}

export function formatOrder(order, { withItem = false, withUser = true, list = false }) {

  const {
    id, qty, price, itemCode, userName,
  } = order;

  const res = [
    order.isActive ? '✅' : '⏸',
    !list && `/order_${id}`,
    withItem ? `<b>${itemNameByCode(itemCode)}</b>` : '',
    `${qty} x ${price}💰`,
  ];

  if (withUser) {
    res.push(`for <b>${userName}</b>`);
  }

  return filter(res).join(' ');

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
      res.push(':\n\n');
      res.push(items.map(o => formatOrder(o, { withItem: true })).join('\n'));
    }

    ctx.replyHTML(res.join(''));

  } catch (e) {
    error(e);
    ctx.replyError(command, e);
  }

}


export async function userOrders(ctx) {

  try {
    ctx.replyHTML(await userOrderList(ctx.from.id));
  } catch (e) {
    ctx.replyError('to list orders', e);
  }

}


export async function userOrderList(userId) {
  const res = await ordering.getOrdersByUserId(userId)
    .then(fpMap(order => formatOrder(order, { withItem: true, withUser: false })));
  return Array.isArray(res) ? res.join('\n') : 'You have no orders';
}
