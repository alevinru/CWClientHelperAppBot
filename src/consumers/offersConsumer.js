import filter from 'lodash/filter';
import map from 'lodash/map';

const debug = require('debug')('laa:cwb:offers');

let minOfferDate;

setMinOfferDate();
setInterval(setMinOfferDate, 1000);

function setMinOfferDate() {
  const now = new Date();
  now.setSeconds(now.getSeconds() - 2);
  minOfferDate = now;
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

export async function consumeOffers(msg, ack) {

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

  debug('consume', deliveryTag, ts, `"${sellerName}" offers`, itemName, `${offerQty} x ${offerPrice}💰`);
  const hook = offerHooks[itemName];

  if (ts < minOfferDate) {
    debug('consume ignore old');
  } else if (hook) {
    await hook(offer);
  }

  ack();

}
