import CWExchange, * as CW from 'cw-rest-api';
import log from '../services/log';

import consumeSEXDigest from './exConsumer';
import consumeAUDigest from './auConsumer';
import onConsumeDeals from './dealsConsumer';
import onConsumeDuels from './duelsConsumer';

const { debug } = log('consumers');

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
    duels: onConsumeDuels,
  },
  bindIO: false,
  noAck: true,
});

cw.connect({ timeout: process.env.CW_TIMEOUT })
  .then(() => debug('Start polling'));
