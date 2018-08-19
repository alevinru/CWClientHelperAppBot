import Telegraf from 'telegraf';

const { BOT_TOKEN } = process.env;
const options = { username: process.env.BOT_USER_NAME };
export const BOT_ID = BOT_TOKEN.match(/^[^:]*/)[0];

const debug = require('debug')('laa:cwb:bot');

export default new Telegraf(BOT_TOKEN, options);

debug('Starting bot id:', BOT_ID);
