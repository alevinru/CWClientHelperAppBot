import filter from 'lodash/filter';
import map from 'lodash/map';
import find from 'lodash/find';
import first from 'lodash/first';

import log from './log';
import * as redis from './redis';
import { BOT_ID } from './bot';
import Order from '../models/Order';

import { getProfile } from './profile';
import { onGotOffer, refreshTraderCache, getCachedTrader } from './trading';

import { itemNameByCode } from './cw';
import { addOfferHook, dropOfferHooks } from '../consumers/offersConsumer';

const ORDERS_PREFIX = 'orders';

const { debug, error } = log('ordering');

redis.client.on('connect', () => setTimeout(hookOffers, 1000));

function getId() {
  return redis.getId(ORDERS_PREFIX);
}

function ordersQueueKey(code) {
  return `${ORDERS_PREFIX}_queue_${code}`;
}

export async function getOrderById(id) {

  const order = await Order.findOne({ id, botId: BOT_ID });

  if (!order) {
    return order;
  }

  const { itemCode } = order;

  const topId = await topOrderId(itemCode);

  return {
    ...order.toObject(),
    isActive: topId === order.id,
  };

}

export async function removeOrder(id) {
  const order = await Order.findOne({ id, botId: BOT_ID });
  if (!order) {
    return false;
  }
  await redis.lremAsync(ordersQueueKey(order.itemCode), 0, id);
  await Order.deleteOne({ id, botId: BOT_ID });
  return true;
}

export async function addOrder(userId, itemCode, qty, price, token) {

  const id = await getId();

  const { userName } = await getProfile(userId);

  const itemName = itemNameByCode(itemCode);

  if (!itemName) {
    const res = `Unknown item code "${itemCode}"`;
    debug('addOrder', res);
    throw Error(res);
  }

  const topId = await setOrderTop(id, userId, itemCode);

  const order = new Order({
    id,
    userId,
    userName,
    itemCode,
    itemName,
    qty: parseInt(qty, 0),
    price: parseInt(price, 0),
    token,
    ts: new Date(),
    botId: BOT_ID,
  });

  debug('addOrder', itemName, order, topId);

  await order.save();

  return {
    ...order.toObject(),
    isActive: topId === id,
  };

}

export async function setTopOrders() {
  debug('setTopOrders');
}

export async function setOrderTop(id, userId, itemCode) {

  const queueKey = ordersQueueKey(itemCode);
  await redis.lremAsync(queueKey, 0, id);

  const orders = await getOrdersByItemCode(itemCode);

  const { priority: userPriority = 0 } = getCachedTrader(userId) || {};

  const pos = find(orders, ({ userId: traderId }) => {
    const { priority = 0 } = getCachedTrader(traderId) || {};
    return priority > userPriority;
  });

  if (!pos) {
    await redis.rpushAsync(queueKey, id);
  } else {
    await redis.linsertAsync(queueKey, 'BEFORE', pos.id, id);
  }

  return topOrderId(itemCode);

}

export async function getOrdersByItemCode(itemCode) {

  const ids = await Order.find({ itemCode, botId: BOT_ID });
  const promises = ids.map(({ id }) => getOrderById(id));
  const orders = await Promise.all(promises);

  debug('getOrdersByItemCode', itemCode, orders.length);

  return filter(orders);

}


export async function getOrdersByUserId(userId) {

  const idx = await Order.find({ userId, botId: BOT_ID });

  return Promise.all(map(idx, o => getOrderById(o.id)));

}

async function topOrderId(itemCode) {
  const ids = await redis.lrangeAsync(ordersQueueKey(itemCode), -1, -1);
  return ids && parseInt(first(ids), 0);
}


export async function getTopOrders() {

  const itemCodes = await Order.aggregate([
    { $match: { botId: BOT_ID } },
    { $group: { _id: '$itemCode' } },
  ]);

  const promises = map(itemCodes, ({ _id: itemCode }) => topOrderId(itemCode));

  const orders = await Promise.all(promises)
    .then(res => map(res, getOrderById))
    .then(res => Promise.all(res));

  return filter(orders);

}

export async function hookOffers() {
  return hookOffersAsync()
    .catch(error);
}

export async function hookOffersAsync() {

  const top = await getTopOrders();

  dropOfferHooks();

  const hooks = map(top, async order => {

    const { itemCode, userId } = order;
    const itemName = itemNameByCode(itemCode);

    const trader = await refreshTraderCache(userId);

    if (trader.isPaused) {
      debug('hookOffers', itemName, `/order_${order.id}`, 'trader is paused');
      return;
    }

    addOfferHook(itemName, offer => onGotOffer(offer, order));

    debug('hookOffers', itemName, `/order_${order.id}`);

  });

  await Promise.all(hooks);

}
