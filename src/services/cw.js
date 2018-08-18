import CWExchange, * as CW from 'cw-rest-api';
import itemsByName from 'cw-rest-api/src/db/itemsByName';
import map from 'lodash/map';
import keyBy from 'lodash/keyBy';

import {
  hgetAsync, hsetAsync, lpushAsync, ltrimAsync, lrangeAsync, setAsync,
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
  const { item: itemName, price, qty } = offer;

  debug('consumeOffers', deliveryTag, ts, itemName, `${qty} x ${price}💰`);


  try {
    const orders = await lrangeAsync(`orders_${itemKey(itemName)}`, 0, 1);
    if (orders && orders.length) {
      debug('consumeOffers got order:', orders[0]);
    }
    ack();
  } catch ({ name, message }) {
    debug(name, message);
  }

}

export async function addOrder(userId, itemCode, qty, price) {

  const order = [userId, price, qty].join('_');

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
