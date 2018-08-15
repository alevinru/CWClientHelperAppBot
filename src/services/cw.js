import CWExchange from 'cw-rest-api';

const debug = require('debug')('laa:cwb:cw');

export const { CW_BOT_ID } = process.env;


debug('Started CW API', CW_BOT_ID);
