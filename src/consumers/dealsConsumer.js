import * as CW from 'cw-rest-api';
import Deal from '../models/Deal';
import { itemKey, itemCodeByName, itemNameByCode } from '../services/cw';
import log from '../services/log';

const { debug, error } = log('deals');

const isNumber = /^\d+$/;

export default async function (msg, ack) {

  const { fields, properties: { timestamp }, content } = msg;
  const { deliveryTag } = fields;
  const ts = isNumber.test(timestamp) ? new Date(timestamp * 1000) : new Date();
  const data = content.toString();
  const deal = JSON.parse(data);
  const {
    item, buyerName, qty, price, sellerName,
  } = deal;

  const itemCode = itemCodeByName(item);

  deal.ts = ts;
  deal.itemCode = itemCode;

  const dealText = `${itemCode} for "${buyerName}" ${qty} x ${price}💰 from "${sellerName}"`;

  debug('Consumed', `#${deliveryTag}`, dealText);

  try {

    await Deal.create(deal);

    if (ack) {
      ack();
    }

  } catch ({ name, message }) {
    error(name, message);
  }

}

// TODO: rewrite rest api with mongo and remove this

export function dealsKey(itemCode) {

  const itemName = itemNameByCode(itemCode);

  return `${CW.QUEUE_DEALS}_${itemKey(itemName)}`;

}
