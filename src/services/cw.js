import CWExchange, * as CW from 'cw-rest-api';
import itemsByName from 'cw-rest-api/src/db/itemsByName';
import map from 'lodash/map';
import keyBy from 'lodash/keyBy';

import {
  hgetAsync, hsetAsync, lpushAsync, ltrimAsync, lrangeAsync, setAsync, lremAsync,
} from './redis';

const debug = require('debug')('laa:cwb:cw');

const MAX_DEALS = 1000;

export const CW_BOT_ID = parseInt(process.env.CW_BOT_ID, 0);

const fanouts = {
  [CW.QUEUE_DEALS]: onConsumeDeals,
  [CW.QUEUE_SEX]: consumeSEXDigest,
  [CW.QUEUE_OFFERS]: consumeOffers,
  [CW.QUEUE_AU]: consumeAUDigest,
  // CW.QUEUE_YELLOW_PAGES,
};

export const cw = new CWExchange({ fanouts });

const itemsByCode = keyBy(map(itemsByName, (code, name) => ({ name, code })), 'code');

debug('Started CW API', CW_BOT_ID);

export async function pricesByItemName(itemName) {

  const prices = await hgetAsync(CW.QUEUE_SEX, itemKey(itemName));

  return JSON.parse(prices);

}

export async function pricesByItemCode(itemCode) {

  const { name: itemName } = itemsByCode[itemCode] || {};

  if (!itemName) {
    throw new Error(`No itemKey for code "${itemCode}"`);
  }

  debug('pricesByItemCode', itemCode, itemName);

  return pricesByItemName(itemName);

}

async function onConsumeDeals(msg, ack) {

  const { fields, properties, content } = msg;
  const { exchange, deliveryTag } = fields;
  const ts = new Date(properties.timestamp * 1000);
  const data = content.toString();
  const {
    item, buyerName, qty, price, sellerName,
  } = JSON.parse(data);

  const id = itemKey(item);
  const listKey = `${CW.QUEUE_DEALS}_${id}`;

  const deal = `${id} for "${buyerName}" ${qty} x ${price}💰 from "${sellerName}"`;

  debug('Consumed', exchange, deliveryTag, ts, deal);

  try {
    await lpushAsync(listKey, data);
    await ltrimAsync(listKey, 0, MAX_DEALS - 1);
    ack();
  } catch ({ name, message }) {
    debug(name, message);
  }

}

async function consumeSEXDigest(msg, ack) {

  const { fields, properties, content } = msg;
  const { deliveryTag } = fields;
  const ts = new Date(properties.timestamp * 1000);
  const data = content.toString();
  const digest = JSON.parse(data);

  debug('consumeSEXDigest', deliveryTag, ts);

  try {
    await digest.map(async ({ name, prices }) => {
      await hsetAsync(CW.QUEUE_SEX, itemKey(name), JSON.stringify(prices));
    });
    ack();
  } catch ({ name, message }) {
    debug(name, message);
  }

}

function itemKey(name) {
  return name.replace(/ /g, '_').toLowerCase();
}

export function itemNameByCode(code) {
  return itemsByCode[code].name;
}

async function consumeOffers(msg, ack) {

  const { fields, properties, content } = msg;
  const { deliveryTag } = fields;
  const ts = new Date(properties.timestamp * 1000);
  const data = content.toString();
  const offer = JSON.parse(data);
  const {
    item: itemName,
    price: offerPrice,
    qty: offerQty,
    sellerName,
  } = offer;

  debug('consumeOffers', deliveryTag, ts, `"${sellerName}" offers`, itemName, `${offerQty} x ${offerPrice}💰`);

  try {

    const hashKey = `orders_${itemKey(itemName)}`;
    const orders = await lrangeAsync(hashKey, 0, 1);

    if (orders && orders.length) {

      const order = orders[0];
      const match = order.match(/(.+)_(.+)_(.+)_(.+)/);

      if (!match) {
        debug('invalid order', order);
        await lremAsync(hashKey, 0, order);
      } else {
        // eslint-disable-next-line
        const [, userId, orderQty, orderPrice, token] = match;
        if (offerPrice <= orderPrice) {
          debug('consumeOffers got order:', userId, `${orderQty} x ${orderPrice}💰`);
          const dealParams = { itemCode: itemsByName[itemName], quantity: 1, price: offerPrice };
          await cw.wantToBuy(parseInt(userId, 0), dealParams, token);
          debug('consumeOffers deal:', dealParams);
          debug('consumeOffers processed order:', userId, `${orderQty} x ${orderPrice}💰`);
          await lremAsync(hashKey, 0, order);
        } else {
          debug('consumeOffers ignore price', offerPrice, 'of', itemName, 'since requested', orderPrice);
        }
      }

    }

    ack();

  } catch (e) {
    const { name = 'Error', message = e } = e;
    debug('consumeOffers', name, message);
  }

}

export async function addOrder(userId, itemCode, qty, price, token) {

  const order = [userId, qty, price, token].join('_');

  debug('addOrder', itemCode, order);

  const key = itemKey(itemNameByCode(itemCode));
  await lpushAsync(`orders_${key}`, order);

}

export async function getOrdersByItemCode(itemCode) {

  const key = itemKey(itemNameByCode(itemCode));
  const res = await lrangeAsync(`orders_${key}`, 0, -1);

  debug('getOrders', itemCode, res);

  return res;

}

async function consumeAUDigest(msg, ack) {

  const { fields, properties, content } = msg;
  const { deliveryTag } = fields;
  const ts = new Date(properties.timestamp * 1000);
  const data = content.toString();
  const digest = JSON.parse(data);

  debug('consumeAUDigest', deliveryTag, ts);

  try {
    await setAsync(CW.QUEUE_AU, JSON.stringify(digest));
    ack();
  } catch ({ name, message }) {
    debug(name, message);
  }

}
