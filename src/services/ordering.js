import filter from 'lodash/filter';
import keyBy from 'lodash/keyBy';
import map from 'lodash/map';

import * as redis from './redis';
import bot from './bot';
import { getProfile } from './profile';

import { itemNameByCode, cw } from './cw';
import { addOfferHook, dropOfferHooks } from '../consumers/offersConsumer';

const ORDERS_PREFIX = 'orders';
const ID_TO_ITEM_CODE_HASH = 'orders_idx_itemCode';

const debug = require('debug')('laa:cwb:ordering');

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
  return redis.hgetallAsync(orderKey(id))
    .then(order => order && Object.assign(order, {
      qty: parseInt(order.qty, 0),
      price: parseInt(order.price, 0),
      userId: parseInt(order.userId, 0),
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

  const { userName } = await getProfile(userId);

  const itemName = itemNameByCode(itemCode);

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

export async function hookOffers() {

  try {

    const top = await getTopOrders();

    dropOfferHooks();

    top.forEach(order => {
      const { itemCode } = order;
      const itemName = itemNameByCode(itemCode);
      addOfferHook(itemName, offer => onGotOffer(offer, order, itemCode));
      debug('hookOffers', itemName, `/order_${order.id}`);
    });

  } catch (e) {
    debug(e);
  }

}


export async function getTopOrders() {

  const index = await redis.hgetallAsync(ID_TO_ITEM_CODE_HASH);
  const itemCodes = map(keyBy(index, itemCode => itemCode));
  const promises = map(itemCodes, itemCode => redis.lrangeAsync(ordersQueueKey(itemCode), 0, 0));

  return Promise.all(promises)
    .then(res => map(res, getOrderById))
    .then(res => Promise.all(res));

}

async function onGotOffer(offer, itemCode, itemName, order) {

  const {
    price: offerPrice,
    qty: offerQty
  } = offer;

  const {
    price: orderPrice,
    qty: orderQty,
    userId,
    token,
  } = order;

  if (offerPrice > orderPrice) {
    return;
  }

  try {

    const deal = {
      itemCode,
      quantity: orderQty > offerQty ? offerQty : orderQty,
      price: offerPrice,
      exactPrice: true,
    };

    await cw.wantToBuy(userId, deal, token);

    replyOrderSuccess(offer, order, deal);

  } catch (e) {

    replyOrderFail(e, offer, order);

  }

}


function replyOrderFail(e, offer, order) {

  const { name = 'Error', message = e } = e;
  const { item: itemName, sellerName, qty } = offer;

  const errMsg = [
    `⚠️ Missed ${qty} x ${offer.price}💰`,
    ` of <b>${itemName}</b> from <b>${sellerName}</b>\n`,
    `/order_${order.id} deal failed with`,
    ` ${name.toLocaleLowerCase()}: <b>${message}</b>.`,
  ];

  bot.telegram.sendMessage(order.userId, errMsg.join(''), { parse_mode: 'HTML' })
    .catch(errBot => debug('replyOrderFail', errBot.message));

  debug('consumeOffers', name, message);

}

function replyOrderSuccess(offer, order, dealParams) {

  debug('replyOrderSuccess:', dealParams);

  const { item: itemName, sellerName, qty } = offer;

  const reply = [
    `✅ Got <b>${itemName}</b> ${dealParams.quantity} x ${dealParams.price}💰`,
    ` of <b>${qty}</b> from <b>${sellerName}</b>`,
    ` by /order_${order.id}`,
  ];
  bot.telegram.sendMessage(order.userId, reply.join(''), { parse_mode: 'HTML' })
    .catch(({ name, message }) => debug('onGotOffer', name, message));

}
