import filter from 'lodash/filter';
import keyBy from 'lodash/keyBy';
import map from 'lodash/map';
import fpMap from 'lodash/fp/map';
import fpFilter from 'lodash/fp/filter';
import find from 'lodash/find';

import log from './log';
import * as redis from './redis';

import { getProfile } from './profile';
import { onGotOffer, refreshTraderCache, getCachedTrader } from './trading';

import { itemNameByCode } from './cw';
import { addOfferHook, dropOfferHooks } from '../consumers/offersConsumer';

const ORDERS_PREFIX = 'orders';
const ID_TO_ITEM_CODE_HASH = 'orders_idx_itemCode';

const { debug, error } = log('ordering');

redis.client.on('connect', () => setTimeout(hookOffers, 1000));

function getId() {
  return redis.getId(ORDERS_PREFIX);
}

function ordersQueueKey(code) {
  return `${ORDERS_PREFIX}_queue_${code}`;
}

function orderKey(id) {
  return `order_${id}`;
}

export async function getOrderById(id) {

  const order = await redis.hgetallAsync(orderKey(id));

  if (!order) {
    return order;
  }

  const { itemCode } = order;

  const [topId] = await redis.lrangeAsync(ordersQueueKey(itemCode), -1, -1) || [];

  debug('getOrderById:', itemCode, id, topId);

  return Object.assign(order, {
    qty: parseInt(order.qty, 0),
    price: parseInt(order.price, 0),
    userId: parseInt(order.userId, 0),
    isActive: topId === id,
  });

}

export async function removeOrder(id) {
  const itemCode = await redis.hgetAsync(ID_TO_ITEM_CODE_HASH, id);
  if (itemCode) {
    await redis.hdelAsync(ID_TO_ITEM_CODE_HASH, id);
    await redis.lremAsync(ordersQueueKey(itemCode), 0, id);
    await redis.delAsync(orderKey(id));
  }
  return !!itemCode;
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

  const order = {
    id,
    itemCode,
    itemName,
    qty: parseInt(qty, 0),
    price: parseInt(price, 0),
    userId: parseInt(userId, 0),
    userName,
    token,
  };

  debug('addOrder', itemName, order);

  await setOrderTop(id, userId, itemCode);

  await redis.hsetAsync(ID_TO_ITEM_CODE_HASH, id, itemCode);
  await redis.hmsetAsync(orderKey(id), order);

  return order;

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

}

export async function getOrdersByItemCode(itemCode) {

  const ids = await redis.lrangeAsync(ordersQueueKey(itemCode), 0, -1);
  const promises = ids.map(id => getOrderById(id));
  const orders = await Promise.all(promises);

  debug('getOrdersByItemCode', itemCode, orders.length);

  return filter(orders);

}


export async function getOrdersByUserId(theUserId) {

  const idx = await redis.hgetallAsync(ID_TO_ITEM_CODE_HASH);

  const getIdx = (itemCode, id) => redis
    .hgetAsync(orderKey(id), 'userId')
    .then(userId => {

      debug('getOrdersByUserId', itemCode, id, userId);

      return {
        userId: parseInt(userId, 0),
        id,
        itemCode,
      };

    });

  return Promise.all(map(idx, getIdx))
    .then(fpFilter({ userId: theUserId }))
    .then(fpMap(o => getOrderById(o.id)))
    .then(res => Promise.all(res));

}


export async function getTopOrders() {

  const index = await redis.hgetallAsync(ID_TO_ITEM_CODE_HASH);
  const itemCodes = map(keyBy(index, itemCode => itemCode));
  const promises = map(itemCodes, itemCode => redis.lrangeAsync(ordersQueueKey(itemCode), -1, -1));

  return Promise.all(promises)
    .then(res => map(res, getOrderById))
    .then(res => Promise.all(res));

}


export async function hookOffers() {

  try {

    const top = await getTopOrders();

    dropOfferHooks();

    top.forEach(async order => {

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

  } catch (e) {
    error(e);
  }

}
