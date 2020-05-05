import Telegraf from 'telegraf';
import log from './log';

const SocksAgent = require('socks5-https-client/lib/Agent');

const { BOT_TOKEN, SOCKS_HOST, SOCKS_PORT } = process.env;
const options = { username: process.env.BOT_USER_NAME };

if (SOCKS_HOST) {

  const { SOCKS_USERNAME, SOCKS_PWD } = process.env;

  const agent = new SocksAgent({
    socksHost: SOCKS_HOST,
    socksPort: parseInt(SOCKS_PORT, 0),
    socksUsername: SOCKS_USERNAME,
    socksPassword: SOCKS_PWD,
  });

  options.telegram = { agent };

}

export const BOT_ID = parseInt(BOT_TOKEN.match(/^[^:]*/)[0], 0);
export const { username: BOT_USER_NAME } = options;

const { debug, error } = log('bot');

const bot = new Telegraf(BOT_TOKEN, options);

export default bot;

debug('Starting bot id:', BOT_ID, BOT_USER_NAME, SOCKS_HOST);

export function exceptionHandler(ctx, next) {

  setImmediate(() => {
    return next()
      // .then(() => debug('exceptionHandler', 'end'))
      .catch(({ name, message }) => {
        error('exceptionHandler', name, message);
        return ctx.replyWithHTML(`Error: ${message}`, { disable_notification: true });
      });
  });

}


function hearsRe(command) {

  return new RegExp(`^/${command}($|@${BOT_USER_NAME}$)`, 'i');

}

export function botHears(command, mw) {
  bot.hears(hearsRe(command), mw);
}
