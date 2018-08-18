import CWExchange, * as CW from 'cw-rest-api';
import itemsByName from 'cw-rest-api/src/db/itemsByName';
import map from 'lodash/map';
import keyBy from 'lodash/keyBy';

import {
  hgetAsync, hsetAsync, lpushAsync, ltrimAsync,
} from './redis';

const debug = require('debug')('laa:cwb:cw');

const MAX_DEALS = 1000;

export const CW_BOT_ID = parseInt(process.env.CW_BOT_ID, 0);

const fanouts = {
  [CW.QUEUE_DEALS]: onConsumeDeals,
  [CW.QUEUE_SEX]: consumeSEXDigest,
  // CW.QUEUE_AU,
  // CW.QUEUE_OFFERS,
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

  const deal = `${id} for "${buyerName}" ${qty} x ${price} from "${sellerName}"`;

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
