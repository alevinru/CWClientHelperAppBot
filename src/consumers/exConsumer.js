import * as CW from 'cw-rest-api';
import { hsetAsync } from '../services/redis';
import { itemKey } from '../services/cw';
import log from '../services/log';

const { debug, error } = log('ex');

export default async function (msg, ack) {

  const { fields, properties, content } = msg;
  const { deliveryTag } = fields;
  const ts = new Date(properties.timestamp * 1000);
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
