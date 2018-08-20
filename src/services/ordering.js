import filter from 'lodash/filter';
import keyBy from 'lodash/keyBy';
import map from 'lodash/map';

import * as redis from './redis';
import bot from './bot';

import {
  itemNameByCode, addOfferHook, cw, itemsByName,
} from './cw';

const ORDERS_PREFIX = 'orders';
const IDS_HASH = 'ids';
const ID_TO_ITEM_CODE_HASH = 'orders_idx_itemCode';

const debug = require('debug')('laa:cwb:ordering');

redis.client.on('connect', () => setTimeout(hookOffers, 1000));

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
  return redis.hgetallAsync(orderKey(id))
    .then(order => Object.assign(order, {
      qty: parseInt(order.qty, 0),
      price: parseInt(order.price, 0),
    }));
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
    id,
    userId,
    itemCode,
    qty: parseInt(qty, 0),
    price: parseInt(price, 0),
    token,
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
  const promises = ids.map(id => getOrderById(id));
  const orders = await Promise.all(promises);

  debug('getOrdersByItemCode', itemCode, orders);

  return filter(orders);

}

async function hookOffers() {

  try {
    const top = await getTopOrders();

    top.forEach(order => {
      const { itemCode } = order;
      const itemName = itemNameByCode(itemCode);
      addOfferHook('Stick', offer => onGotOffer(offer, itemCode, itemName, order));
      debug('hookOffers', itemName, order.id);
    });

  } catch (e) {
    debug(e);
  }

}


export async function getTopOrders() {

  const index = await redis.hgetallAsync(ID_TO_ITEM_CODE_HASH);
  // debug('getTopOrders index:', index);
  const itemCodes = map(keyBy(index, itemCode => itemCode));
  // debug('getTopOrders itemCodes:', itemCodes);
  const promises = map(itemCodes, itemCode => redis.lrangeAsync(ordersQueueKey(itemCode), 0, 0));

  return Promise.all(promises)
    .then(res => map(res, getOrderById))
    .then(res => Promise.all(res));

}

async function onGotOffer(offer, itemCode, itemName, order) {

  if (itemName !== offer.item) {
    return;
  }

  const {
    price: offerPrice,
    qty: offerQty,
    sellerName,
  } = offer;

  try {

    // const hashKey = ordersQueueKey(itemCode);
    // const orders = await redis.lrangeAsync(hashKey, 0, 1);

    // if (!orders || !orders.length) {
    //   return;
    // }
    if (!order) {
      debug('invalid order id', order);
      // await redis.lremAsync(hashKey, 0, order);
      return;
    }

    const orderId = order.id;
    // const order = await getOrderById(orderId);

    const {
      userId, qty: orderQty, price: orderPrice, token,
    } = order;

    if (offerPrice > orderPrice) {
      debug('onGotOffer ignore price', offerPrice, 'of', itemName, 'since requested', orderPrice);
      return;
    }

    debug('onGotOffer got order:', orderId, `${orderQty} x ${orderPrice}💰`);

    const dealParams = {
      itemCode: itemsByName[itemName],
      quantity: orderQty > offerQty ? offerQty : orderQty,
      price: offerPrice,
    };

    await cw.wantToBuy(parseInt(userId, 0), dealParams, token);

    debug('onGotOffer deal:', dealParams);

    const reply = [
      '✅',
      `/order_${orderId} deal success!\n`,
      `Got <b>${itemName}</b> ${dealParams.quantity} x ${dealParams.price}💰 from `,
      `<b>${offerQty}</b> offered by <b>${sellerName}</b>`,
    ];

    debug('onGotOffer processed order:', reply);

    // await removeOrder(orderId);
    await bot.telegram.sendMessage(userId, reply.join(' '), { parse_mode: 'HTML' });

  } catch (e) {
    const { name = 'Error', message = e } = e;
    const errMsg = [
      `⚠️ /order_${order.id} deal failed with `,
      `${name.toLocaleLowerCase()}: <b>${message}</b>.\n`,
      `Missed offer of ${offerQty} of <b>${itemName}</b> from <b>${sellerName}</b>`,
    ];
    bot.telegram.sendMessage(order.userId, errMsg.join(''), { parse_mode: 'HTML' })
      .catch(errBot => debug('consumeOffers', errBot.message));
    debug('consumeOffers', name, message);
  }

}
