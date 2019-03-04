import CWExchange, * as CW from 'cw-rest-api';
import log from '../services/log';

import consumeSEXDigest from './exConsumer';
import consumeAUDigest from './auConsumer';
import onConsumeDeals from './dealsConsumer';
import onConsumeDuels from './duelsConsumer';
import yp from './ypConsumer';

import * as mongo from '../models';

const { debug, error } = log('consumers');

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
    [CW.QUEUE_DUELS]: onConsumeDuels,
    [CW.QUEUE_YELLOW_PAGES]: yp,
  },
  bindIO: false,
  noAck: true,
});

mongo.connect()
  .then(() => cw.connect({ timeout: process.env.CW_TIMEOUT }))
  .then(() => debug('Start polling'))
  .catch(error);

process.on('SIGINT', async () => {
  error('SIGINT');
  await mongo.disconnect().catch(error);
  process.exit();
});
