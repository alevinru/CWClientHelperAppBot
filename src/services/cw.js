import CWExchange from 'cw-rest-api/src/exchange/CWExchange';

const debug = require('debug')('laa:cwb:cw');

export const CW_BOT_ID = parseInt(process.env.CW_BOT_ID, 0);
export const cw = new CWExchange();

cw.connect();

debug('Started CW API', CW_BOT_ID);
