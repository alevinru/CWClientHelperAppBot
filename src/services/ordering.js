import * as redis from './redis';
import {
  itemNameByCode, itemKey, addOfferHook, cw, itemsByName,
} from './cw';

const ORDERS_PREFIX = 'orders';
const IDS_HASH = 'ids';

const debug = require('debug')('laa:cwb:ordering');

redis.client.on('connect', hookOffers);

function getId() {
  return redis.hincrbyAsync(IDS_HASH, ORDERS_PREFIX, 1);
}

function ordersQueueKey(code) {
  return `${ORDERS_PREFIX}_${code}`;
}

function orderKey(itemCode, id) {
  return `${ORDERS_PREFIX}_${itemCode}_${id}`;
}

export async function addOrder(userId, itemCode, qty, price, token) {

  const id = await getId();

  const order = {
    id, userId, qty, price, token, itemCode,
  };

  const itemName = itemNameByCode(itemCode);
  debug('addOrder', itemName, order);

  await redis.rpushAsync(ordersQueueKey(itemCode), id);
  await redis.hmsetAsync(orderKey(itemCode, id), order);

  return order;

}

export async function getOrdersByItemCode(itemCode) {

  const ids = await redis.lrangeAsync(ordersQueueKey(itemCode), 0, -1);
  const promises = ids.map(id => redis.hgetallAsync(orderKey(itemCode, id)));
  const orders = await Promise.all(promises);

  debug('getOrdersByItemCode', itemCode, orders);

  return orders;

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

  try {

    const hashKey = `orders_${itemKey(itemName)}`;
    const orders = await redis.lrangeAsync(hashKey, 0, 1);

    if (!orders || !orders.length) {
      return;
    }

    const order = orders[0];
    const match = order.split('_');

    if (match.length !== 4) {
      debug('invalid order', order);
      // await redis.lremAsync(hashKey, 0, order);
      return;
    }

    const [userId, orderQty, orderPrice, token] = match;

    if (offerPrice > orderPrice) {
      debug('onGotOffer ignore price', offerPrice, 'of', itemName, 'since requested', orderPrice);
      return;
    }

    debug('onGotOffer got order:', userId, `${orderQty} x ${orderPrice}💰`);

    const dealParams = { itemCode: itemsByName[itemName], quantity: 1, price: offerPrice };
    await cw.wantToBuy(parseInt(userId, 0), dealParams, token);

    debug('onGotOffer deal:', dealParams);
    debug('onGotOffer processed order:', userId, `${orderQty} x ${orderPrice}💰`);

    await redis.lremAsync(hashKey, 0, order);

  } catch (e) {
    const { name = 'Error', message = e } = e;
    debug('consumeOffers', name, message);
  }

}
