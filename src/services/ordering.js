import filter from 'lodash/filter';
import * as redis from './redis';
import {
  itemNameByCode, addOfferHook, cw, itemsByName,
} from './cw';

const ORDERS_PREFIX = 'orders';
const IDS_HASH = 'ids';
const ID_TO_ITEM_CODE_HASH = 'orders_idx_itemCode';

const debug = require('debug')('laa:cwb:ordering');

redis.client.on('connect', hookOffers);

function getId() {
  return redis.hincrbyAsync(IDS_HASH, ORDERS_PREFIX, 1);
}

function ordersQueueKey(code) {
  return `${ORDERS_PREFIX}_queue_${code}`;
}

function orderKey(id) {
  return `order_${id}`;
}

export async function getOrderById(id) {
  return redis.hgetallAsync(orderKey(id));
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

  const order = {
    id, userId, qty, price, token, itemCode,
  };

  const itemName = itemNameByCode(itemCode);
  debug('addOrder', itemName, order);

  await redis.hsetAsync(ID_TO_ITEM_CODE_HASH, id, itemCode);
  await redis.rpushAsync(ordersQueueKey(itemCode), id);
  await redis.hmsetAsync(orderKey(id), order);

  return order;

}

export async function getOrdersByItemCode(itemCode) {

  const ids = await redis.lrangeAsync(ordersQueueKey(itemCode), 0, -1);
  const promises = ids.map(id => redis.hgetallAsync(orderKey(id)));
  const orders = await Promise.all(promises);

  debug('getOrdersByItemCode', itemCode, orders);

  return filter(orders);

}

function hookOffers() {

  addOfferHook('Stick', onGotOffer);

}


async function onGotOffer(offer) {

  const {
    item: itemName,
    price: offerPrice,
    // qty: offerQty,
  } = offer;

  const itemCode = itemsByName[itemName];

  try {

    const hashKey = ordersQueueKey(itemCode);
    const orders = await redis.lrangeAsync(hashKey, 0, 1);

    if (!orders || !orders.length) {
      return;
    }

    const orderId = orders[0];
    const order = await getOrderById(orderId);

    if (!order) {
      debug('invalid order id', orderId);
      // await redis.lremAsync(hashKey, 0, order);
      return;
    }

    const {
      userId, orderQty, orderPrice, token,
    } = order;

    if (offerPrice > orderPrice) {
      debug('onGotOffer ignore price', offerPrice, 'of', itemName, 'since requested', orderPrice);
      return;
    }

    debug('onGotOffer got order:', userId, `${orderQty} x ${orderPrice}💰`);

    const dealParams = { itemCode: itemsByName[itemName], quantity: 1, price: offerPrice };
    await cw.wantToBuy(parseInt(userId, 0), dealParams, token);

    debug('onGotOffer deal:', dealParams);
    debug('onGotOffer processed order:', userId, `${orderQty} x ${orderPrice}💰`);

    await removeOrder(orderId);

  } catch (e) {
    const { name = 'Error', message = e } = e;
    debug('consumeOffers', name, message);
  }

}
