import Telegraf from 'telegraf';
import { cw } from './services';
import session from './services/session';
import { fromCWFilter } from './config/filters';
import { auth, authCode } from './middleware/auth';

import trades from './middleware/trades';
import order, { orders, orderById, rmById } from './middleware/order';

const debug = require('debug')('laa:cwb:index');

const { BOT_TOKEN } = process.env;
const options = { username: process.env.BOT_USER_NAME };
const bot = new Telegraf(BOT_TOKEN, options);
const BOT_ID = BOT_TOKEN.match(/^[^:]*/)[0];


debug('Starting bot id:', BOT_ID);

require('./config/context').default(bot);

/** Middleware
 * */

bot.use(exceptionHandler);
bot.use(session({ botId: BOT_ID }).middleware());

bot.command('auth', auth);

bot.hears(/^\/trades[ _]([a-z0-9]+)$/, trades);
bot.hears(/^\/order[ _]([a-z0-9]+)[ _](\d+)[ _](\d+)$/, order);
bot.hears(/^\/orders[ _]([a-z0-9]+)$/, orders);

bot.hears(/^\/order[ _]([a-z0-9]+)$/, orderById);
bot.hears(/^\/rmorder[ _]([a-z0-9]+)$/, rmById);


bot.command('start', require('./middleware/start').default);
bot.command('hello', require('./middleware/hello').default);
bot.command('profile', require('./middleware/profile').default);
bot.command('stock', require('./middleware/stock').default);

bot.hears(/^\/wtb[ _](.+)[ _](.+)[ _](.+)$/, require('./middleware/wtb').default);

bot.on('message', Telegraf.optional(fromCWFilter, authCode));
bot.on('message', require('./middleware/message').default);

cw.connect({ timeout: process.env.CW_TIMEOUT })
  .then(() => bot.startPolling())
  .then(() => debug('Start polling'));

/** Exception handlers
 * */

function exceptionHandler(ctx, next) {

  debug('exceptionHandler', 'start');

  return next()
    .then(() => debug('exceptionHandler', 'end'))
    .catch(({ name, message }) => {
      debug(name, message);
      return ctx.reply(`Error: ${message}`);
    });

}

bot.catch(({ name, message }) => {
  debug(name, message);
});
