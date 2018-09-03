import Telegraf from 'telegraf';
import { cw } from './services';
import log from './services/log';
import session from './services/session';
import bot, { BOT_ID } from './services/bot';
import { fromCWFilter } from './config/filters';
import { auth, authCode } from './middleware/auth';
import wtb from './middleware/wtb';

import * as trades from './middleware/trades';
import * as ord from './middleware/order';
import * as traders from './middleware/traders';
import * as users from './middleware/hello';

import start from './middleware/start';
import stock from './middleware/stock';
import profile from './middleware/profile';

const { debug, error } = log('index');

require('./config/context').default(bot);

/*
Low level middleware
*/

bot.use(exceptionHandler);
bot.use(session({ botId: BOT_ID }).middleware());

/*
Trading
 */

bot.command('trading', traders.tradingStatus);

bot.hears(/^\/trading[ _](on|off)$/, traders.tradingActive);
bot.hears(/^\/trades[ _]([a-z0-9]+)$/, trades.itemTrades);

bot.hears(/^\/traders$/, traders.traders);
bot.hears(/^\/grant_trading[ _](\d*)$/, traders.grantTrading);

/*
Orders
 */

bot.hears(/^\/orders_top$/, ord.ordersTop);
bot.hears(/^\/order[ _]([a-z0-9]+)[ _](\d+)[ _](\d+)[ ]?(\d*)$/, ord.createOrder);
bot.hears(/^\/orders[ _]([a-z0-9]+)$/, ord.orders);

bot.hears(/^\/order[ _]([a-z0-9]+)$/, ord.orderById);
bot.hears(/^\/rmorder[ _]([a-z0-9]+)$/, ord.rmById);

/*
Users
 */

bot.command('start', start);
bot.command('auth', auth);
bot.command('hello', users.hello);
bot.command('users', users.listUsers);

/*
ChatWars
 */

bot.command('stock', stock);
bot.hears(/^\/profile[ _]?(\d*)$/, profile);
bot.hears(/^\/wtb[ _]([a-z0-9]+)[ _](\d+)[ _](\d+)[ ]?(\d*)$/, wtb);
bot.on('message', Telegraf.optional(fromCWFilter, authCode));

/*
Other
 */

bot.on('message', require('./middleware/message').default);

cw.connect({ timeout: process.env.CW_TIMEOUT })
  .then(() => bot.startPolling())
  .then(() => debug('Start polling'));

/*
Exception handlers
*/

function exceptionHandler(ctx, next) {

  // debug('userId', 'start');

  return next()
  // .then(() => debug('exceptionHandler', 'end'))
    .catch(({ name, message }) => {
      error('exceptionHandler', name, message);
      return ctx.reply(`Error: ${message}`);
    });

}

bot.catch(({ name, message }) => {
  debug(name, message);
});
