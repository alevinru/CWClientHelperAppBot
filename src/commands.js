import Telegraf from 'telegraf';

import bot from './services/bot';
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

/*
Trading
 */

bot.command('trading', traders.tradingStatus);

bot.hears(/^\/trading[ _](on|off)$/, traders.tradingActive);
bot.hears(/^\/trades[ _]([a-z0-9]+)$/, trades.itemTrades);

bot.hears(/^\/traders$/, traders.traders);
bot.hears(/^\/grant[ _]trading[ _](\d*)$/, traders.grantTrading);

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
bot.hears(/^\/hello[ _]?(\d+)?$/, users.hello);
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
