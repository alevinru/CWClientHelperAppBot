import Telegraf from 'telegraf';
import { cw } from './services';
import session from './services/session';
import bot, { BOT_ID } from './services/bot';
import { fromCWFilter } from './config/filters';
import { auth, authCode } from './middleware/auth';
import wtb from './middleware/wtb';

import * as trades from './middleware/trades';
import * as ord from './middleware/order';
import * as traders from './middleware/traders';
import * as users from './middleware/hello';

const debug = require('debug')('laa:cwb:index');

require('./config/context').default(bot);

/** Middleware
 * */

bot.use(exceptionHandler);
bot.use(session({ botId: BOT_ID }).middleware());

bot.command('auth', auth);

bot.hears(/^\/trading[ _](on|off|status)$/, trades.trading);
bot.hears(/^\/trades[ _]([a-z0-9]+)$/, trades.itemTrades);

bot.hears(/^\/traders$/, traders.traders);
bot.hears(/^\/grant_trading[ _](\d*)$/, traders.grantTrading);

bot.hears(/^\/orders_top$/, ord.ordersTop);
bot.hears(/^\/order[ _]([a-z0-9]+)[ _](\d+)[ _](\d+)[ ]?(\d*)$/, ord.createOrder);
bot.hears(/^\/orders[ _]([a-z0-9]+)$/, ord.orders);

bot.hears(/^\/order[ _]([a-z0-9]+)$/, ord.orderById);
bot.hears(/^\/rmorder[ _]([a-z0-9]+)$/, ord.rmById);


bot.command('start', require('./middleware/start').default);

bot.command('hello', users.hello);
bot.command('users', users.list);

// bot.command('profile', require('./middleware/profile').default);
bot.command('stock', require('./middleware/stock').default);

bot.hears(/^\/profile[ _]?(\d*)$/, require('./middleware/profile').default);

bot.hears(/^\/wtb[ _]([a-z0-9]+)[ _](\d+)[ _](\d+)[ ]?(\d*)$/, wtb);

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
