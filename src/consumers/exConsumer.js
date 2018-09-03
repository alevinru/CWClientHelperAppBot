import * as CW from 'cw-rest-api';
import { hsetAsync } from '../services/redis';
import { itemKey } from '../services/cw';
import log from '../services/log';

const { debug, error } = log('ex');
const isNumber = /^\d+$/;

export default async function (msg, ack) {

  const { fields, properties: { timestamp }, content } = msg;
  const { deliveryTag } = fields;
  const ts = isNumber.test(timestamp) ? new Date(timestamp * 1000) : new Date();
  const data = content.toString();
  const digest = JSON.parse(data);

  debug('consumed', `#${deliveryTag}`, ts, `(${digest.length})`);

  try {
    await digest.map(async ({ name, prices }) => {
      // prices.ts = ts.toISOString();
      await hsetAsync(CW.QUEUE_SEX, itemKey(name), JSON.stringify(prices));
    });
    if (ack) {
      ack();
    }
  } catch ({ name, message }) {
    error(name, message);
  }

}
