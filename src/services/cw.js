import CWExchange from 'cw-rest-api';

const debug = require('debug')('laa:cwb:cw');

export const { CW_BOT_ID } = process.env;
export const cw = new CWExchange();

cw.connect({ timeout: process.env.CW_TIMEOUT });

debug('Started CW API', CW_BOT_ID);
