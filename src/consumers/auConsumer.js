import * as CW from 'cw-rest-api';
import { hsetAsync } from '../services/redis';

import log from '../services/log';

const { debug, error } = log('au');
export default async function (msg, ack) {

  const { fields, properties, content } = msg;
  const { deliveryTag } = fields;
  const ts = new Date(properties.timestamp * 1000);
  const data = content.toString();
  const digest = JSON.parse(data);

  debug('consumed', `#${deliveryTag}`, ts, `(${digest.length})`);

  try {
    await hsetAsync(CW.QUEUE_AU, 'data', JSON.stringify(data));
    await hsetAsync(CW.QUEUE_AU, 'ts', ts.toISOString());
    if (ack) {
      ack();
    }
  } catch ({ name, message }) {
    error(name, message);
  }

}
