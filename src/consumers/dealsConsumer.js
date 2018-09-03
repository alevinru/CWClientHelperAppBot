import * as CW from 'cw-rest-api';
import { lpushAsync, ltrimAsync } from '../services/redis';
import { itemKey, itemNameByCode } from '../services/cw';
import log from '../services/log';

const { debug, error } = log('deals');

const MAX_DEALS = parseInt(process.env.MAX_DEALS, 0) || 1000;

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

  deal.ts = ts.toISOString();

  const id = itemKey(item);
  const listKey = `${CW.QUEUE_DEALS}_${id}`;

  const dealText = `${id} for "${buyerName}" ${qty} x ${price}💰 from "${sellerName}"`;

  debug('Consumed', `#${deliveryTag}`, ts, dealText);

  try {
    await lpushAsync(listKey, JSON.stringify(deal));
    await ltrimAsync(listKey, 0, MAX_DEALS - 1);
    if (ack) {
      ack();
    }
  } catch ({ name, message }) {
    error(name, message);
  }

}


export function dealsKey(itemCode) {

  const itemName = itemNameByCode(itemCode);

  return `${CW.QUEUE_DEALS}_${itemKey(itemName)}`;

}
