import CWExchange, * as CW from 'cw-rest-api';
import map from 'lodash/map';
import keyBy from 'lodash/keyBy';
import filter from 'lodash/filter';

import { hgetAsync } from './redis';

const debug = require('debug')('laa:cwb:cw');

let minOfferDate;

setMinOfferDate();
setInterval(setMinOfferDate, 1000);

export const CW_BOT_ID = parseInt(process.env.CW_BOT_ID, 0);

const fanouts = {
  [CW.QUEUE_OFFERS]: consumeOffers,
  // CW.QUEUE_YELLOW_PAGES,
};

export const cw = new CWExchange({ bindIO: true, fanouts });

export const itemsByName = CW.allItemsByName();
export const itemsByCode = keyBy(map(itemsByName, (code, name) => ({ name, code })), 'code');

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

export function itemKey(name) {
  return name.replace(/ /g, '_').toLowerCase();
}

export function itemNameByCode(code) {
  return itemsByCode[code].name;
}

function setMinOfferDate() {
  const now = new Date();
  now.setSeconds(now.getSeconds() - 2);
  minOfferDate = now;
  // debug('setMinOfferDate', minOfferDate);
}

const offerHooks = {};

export function addOfferHook(itemName, callback) {

  offerHooks[itemName] = callback;

}

export function getOfferHooks() {

  return filter(map(offerHooks, (val, itemCode) => val && itemCode));

}

export function dropOfferHooks() {

  map(offerHooks, (val, key) => {
    offerHooks[key] = false;
  });

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
  const hook = offerHooks[itemName];

  if (ts < minOfferDate) {
    debug('consumeOffers ignore old');
  } else if (hook) {
    await hook(offer);
  }

  ack();

}
