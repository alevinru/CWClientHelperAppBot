import * as redis from './redis';
import {
  itemNameByCode, itemKey, addOfferHook, cw, itemsByName,
} from './cw';


const debug = require('debug')('laa:cwb:ordering');

redis.client.on('connect', hookOffers);

export async function addOrder(userId, itemCode, qty, price, token) {

  const order = [userId, qty, price, token].join('_');

  debug('addOrder', itemCode, order);

  const key = itemKey(itemNameByCode(itemCode));
  await redis.lpushAsync(`orders_${key}`, order);

}

export async function getOrdersByItemCode(itemCode) {

  const key = itemKey(itemNameByCode(itemCode));
  const res = await redis.lrangeAsync(`orders_${key}`, 0, -1);

  debug('getOrders', itemCode, res);

  return res;

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
      await redis.lremAsync(hashKey, 0, order);
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
