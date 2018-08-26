import filter from 'lodash/filter';
import map from 'lodash/map';

const debug = require('debug')('laa:cwb:offers');

const MIN_OFFER_DELAY = 1000;

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

export async function consumeOffers(msg) {

  const { properties, content } = msg;
  const { timestamp } = properties;
  const now = new Date().valueOf() / 1000;
  // const { deliveryTag } = fields;
  // const ts = new Date(timestamp * 1000);
  const data = content.toString();
  const offer = JSON.parse(data);
  // const {
  //   item: itemName,
  //   price: offerPrice,
  //   qty: offerQty,
  //   sellerName,
  // } = offer;

  const hook = offerHooks[offer.item];
  // const log = `"${sellerName}" offers ${itemName} ${offerQty} x ${offerPrice}💰`;
  // debug('consumed', deliveryTag, timestamp, log);

  if (timestamp < now - MIN_OFFER_DELAY) {
    debug('consume ignore old');
  } else if (hook) {
    await hook(offer);
  }

  // if (ack) {
  //   ack();
  // }

}
