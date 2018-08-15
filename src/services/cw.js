import CWExchange, * as CW from 'cw-rest-api';

const debug = require('debug')('laa:cwb:cw');

export const { CW_BOT_ID } = process.env;

const fanouts = [
  // CW.QUEUE_DEALS,
  // CW.QUEUE_AU,
  // CW.QUEUE_OFFERS,
  // CW.QUEUE_SEX,
  // CW.QUEUE_YELLOW_PAGES,
];

export const cw = new CWExchange({ fanouts });

debug('Started CW API', CW_BOT_ID);
