import Telegraf from 'telegraf';

import bot, { BOT_USER_NAME } from './services/bot';
import { fromCWFilter } from './config/filters';

import * as auth from './middleware/auth';

import wtb from './middleware/wtb';

import * as trades from './middleware/trades';
import * as ord from './middleware/order';
import * as traders from './middleware/traders';
import * as users from './middleware/hello';

import start from './middleware/start';
import stock from './middleware/stock';
import profile, { guildInfo, craftBook, gearInfo } from './middleware/profile';

import * as shops from './middleware/shops';
import * as au from './middleware/auction';
import arena from './middleware/arena';

/*
Trading
 */

bot.command('trading', traders.tradingStatus);

bot.hears(/^\/trading[ _](on|off)$/, traders.tradingActive);
bot.hears(/^\/trades[ _]([a-z0-9]+)$/, trades.itemTrades);

bot.hears(/^\/traders$/, traders.traders);
bot.hears(/^\/grant[ _]trading[ _](\d*)[ ]?(\d*)$/, traders.grantTrading);

bot.hears(/^\/t[_]?([a-z0-9]{1,2}\d+)[ _]?(\d+)?([hm])?$/, trades.itemStats);

/*
Orders
 */

function hearsOrders(match, mw) {
  bot.hears(match, ord.checkTraderAuth, mw);
}

hearsOrders(/^\/orders_top$/, ord.ordersTop);
hearsOrders(/^\/order[ _]([a-z0-9]+)[ _](\d+)[ _](\d+)[ ]?(\d*)$/, ord.createOrder);
hearsOrders(/^\/orders[ _]([a-z0-9]+)$/, ord.orders);

hearsOrders(/^\/order[ _]([a-z0-9]+)$/, ord.orderById);
hearsOrders(/^\/rmorder[ _]([a-z0-9]+)$/, ord.rmById);

/*
Users
 */

bot.command('start', start);
bot.command('auth', auth.auth);
bot.command('authGuild', auth.authGuildInfo);
bot.command('authCraftBook', auth.authCraftBook);
bot.command('authGear', auth.authGearInfo);
bot.hears(/^\/hello[ _](\d+)$/, users.hello);
bot.command('hello', users.hello);
bot.command('users', users.listUsers);

/*
ChatWars
 */

bot.command('stock', stock);
bot.hears(/^\/profile[ _]?(\d*)$/, profile);

const gearRe = new RegExp(`^/gear[ _]?(\\d*)?($|@${BOT_USER_NAME})`, 'i');
bot.hears(gearRe, gearInfo);

const guildInfoRe = '(guildInfo|gi)';
bot.hears(hearsRe(`${guildInfoRe}[ _](.+)`), guildInfo);
bot.hears(hearsRe(guildInfoRe), guildInfo);

const craftBookRe = new RegExp(`^/(craftBook|cb)[ _]?(.*)[^@]?($|${BOT_USER_NAME})`, 'i');
bot.hears(craftBookRe, craftBook);

bot.hears(/^\/wtb[ _]([a-z0-9]+)[ _](\d+)[ _](\d+)[ ]?(\d*)$/, wtb);
bot.on('message', Telegraf.optional(fromCWFilter, auth.authCode));

bot.hears(hearsRe('ws[r]?_([a-z0-9]+)'), shops.shopInfo);
bot.hears(hearsRe('mnt'), shops.maintenanceShops);
bot.hears(hearsRe('mnt[ _]([a-z]+)'), shops.maintenanceShops);

bot.hears(hearsRe('l_([0-9]+)'), au.showItem);
bot.hears(hearsRe('bet_([0-9]+)(_[\\d]+)?'), au.showItem);

bot.hears(hearsRe('du[ ](.*)[ ](\\d+)[ ](\\d+)'), arena);
bot.hears(hearsRe('du[ ](.*)[ ](\\d+)'), arena);
bot.hears(hearsRe('du[ ](.*)'), arena);

/*
Other
 */

bot.on('message', require('./middleware/message').default);


function hearsRe(command) {

  return new RegExp(`^/${command}($|@${BOT_USER_NAME}$)`, 'i');

}
