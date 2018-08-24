import CWExchange, * as CW from 'cw-rest-api';
import { hsetAsync } from '../../services/redis';

const debug = require('debug')('laa:cwb:au');

export default class AUConsumer {

  constructor() {

    const cw = new CWExchange({
      fanouts: { [CW.QUEUE_AU]: consumeAUDigest },
      bindIO: false,
    });

    this.cw = cw.connect({ timeout: process.env.CW_TIMEOUT })
      .then(() => debug('Start polling'));

  }

}


async function consumeAUDigest(msg, ack) {

  const { fields, properties, content } = msg;
  const { deliveryTag } = fields;
  const ts = new Date(properties.timestamp * 1000);
  const data = content.toString();
  const digest = JSON.parse(data);

  debug('consumed', deliveryTag, ts, digest.length);

  try {
    await hsetAsync(CW.QUEUE_AU, 'data', JSON.stringify(data));
    await hsetAsync(CW.QUEUE_AU, 'ts', ts.toISOString());
    ack();
  } catch ({ name, message }) {
    debug(name, message);
  }

}
