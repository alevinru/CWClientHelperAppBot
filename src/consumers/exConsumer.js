import CWExchange, * as CW from 'cw-rest-api';
import { hsetAsync } from '../services/redis';
import { itemKey } from '../services/cw';

const debug = require('debug')('laa:cwb:ex');

export default class {

  constructor() {

    const cw = new CWExchange({
      fanouts: { [CW.QUEUE_SEX]: consumeSEXDigest },
      bindIO: false,
    });

    this.cw = cw.connect({ timeout: process.env.CW_TIMEOUT })
      .then(() => debug('Start polling'));

  }

}

async function consumeSEXDigest(msg, ack) {

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
    ack();
  } catch ({ name, message }) {
    debug(name, message);
  }

}
