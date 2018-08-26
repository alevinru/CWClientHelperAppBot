import CWExchange, * as CW from 'cw-rest-api';

import consumeSEXDigest from './exConsumer';
import consumeAUDigest from './auConsumer';
import onConsumeDeals from './dealsConsumer';

const debug = require('debug')('laa:cwb:consumers');

/**
 *
 * This module should be run as a separate process
 *
 */

const cw = new CWExchange({
  fanouts: {
    [CW.QUEUE_AU]: consumeAUDigest,
    [CW.QUEUE_DEALS]: onConsumeDeals,
    [CW.QUEUE_SEX]: consumeSEXDigest,
  },
  bindIO: false,
  noAck: true,
});

cw.connect({ timeout: process.env.CW_TIMEOUT })
  .then(() => debug('Start polling'));
