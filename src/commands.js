import Telegraf from 'telegraf';

import bot, { BOT_USER_NAME } from './services/bot';
import { fromCWFilter } from './config/filters';

import * as auth from './middleware/auth';

import wtb from './middleware/wtb';

import * as trades from './middleware/trades';
import * as ord from './middleware/order';
import * as traders from './middleware/traders';
import * as users from './middleware/hello';
import * as battleReports from './middleware/battleReports';
import * as battles from './middleware/battles';

import start from './middleware/start';
import stock from './middleware/stock';
import profile, { guildInfo, craftBook, gearInfo } from './middleware/profile';

import * as shops from './middleware/shops';
import * as au from './middleware/auction';
import { arena, ownArena, vsArena } from './middleware/arena';
import settings, * as ss from './middleware/settings';

/*
Trading
 */

bot.hears(/^\/trading[ _](on|off)$/, traders.tradingActive);
bot.command('trading', traders.tradingStatus);

bot.hears(/^\/trades[ _]([a-z0-9]+)$/, trades.itemTrades);

bot.hears(/^\/traders$/, traders.traders);
bot.hears(/^\/grant[ _]trading[ _](\d*)[ ]?(\d*)$/, traders.grantTrading);

bot.hears(/^\/t[_ ]?([a-z0-9]{1,2}\d+)[ _]?(\d+)?([hm])?$/, trades.itemStats);
botHears('who[_ ]?([a-z0-9]{1,2}\\d+)[ _](\\d+)[ _](\\d+)([hm])?', trades.itemBuyers);

/*
Orders
 */

function hearsOrders(match, mw) {
  botHears(match, Telegraf.compose([ord.checkTraderAuth, mw]));
}

hearsOrders('orders_top', ord.ordersTop);
hearsOrders('order[ _]([a-z0-9]+)[ _](\\d+)[ _](\\d+)[ ]?(\\d*)', ord.createOrder);
hearsOrders('orders[ _]([a-z0-9]+)', ord.orders);

hearsOrders('order[ _]([a-z0-9]+)', ord.orderById);
hearsOrders('rmorder[ _]([a-z0-9]+)', ord.rmById);
hearsOrders('saorder[ _]([a-z0-9]+)', ord.setOrderActive);

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
botHears('users', users.listUsers);
botHears('gg', users.listUsers);

bot.hears(/^\/(trust|untrust)$/, users.trust);

/*
ChatWars
 */

botHears('stock[ _]?(\\d*)', stock);
botHears('profile[ _]?(\\d*)', profile);
botHears('gear[ _]?(\\d*)', gearInfo);

botHears('gi[ _](.+)', guildInfo);
bot.command('gi', guildInfo);

botHears('(craftBook|cb)[ _]?(.*)', craftBook);

botHears('wtb[ _]([a-z0-9]+)[ _](\\d+)[ _](\\d+)[ ]?(\\d*)', wtb);

botHears('wf[ _]([a-z _0-9]+)', shops.shopsByItem);
botHears('wf (/.+/)', shops.shopsByItem);

botHears('ws[r]?_([a-z0-9]+)', shops.shopInfo);
botHears('mnt[ _]([a-z]+)', shops.maintenanceShops);
bot.command('mnt', shops.maintenanceShops);

botHears('l_([0-9]+)', au.showItem);
botHears('bet_([0-9]+)(_[\\d]+)?', au.showItem);

bot.on('message', Telegraf.optional(fromCWFilter, auth.authCode));

/*
Duels
 */

botHears('du[ ](.+) vs (.+)', vsArena);

botHears('du[g]?[ ](\\d+)[ ](\\d+)', ownArena);
botHears('du[g]?[ ](\\d+)', ownArena);

botHears('du[ ](.+)[ ](\\d+)[ ](\\d+)', arena);
botHears('du[ ](.+)[ ](\\d+)', arena);
botHears('du[ ](.+)', arena);

bot.command('dug', ownArena);
bot.command('du', ownArena);

/*
Battles
 */

botMessage(Telegraf.optional(battles.reportFilter, battles.onReportForward));
botHears('ba[ _]([\\d]{6})[ _]([\\d]{2})', battles.showBattle);


botMessage(Telegraf.optional(battleReports.reportFilter, battleReports.onReportForward));

botHears('rb[ _](\\d{1,4})', battleReports.userReportForPeriod);

botHears('rb[ _]([\\da-h]{24})', battleReports.userReport);
botHears('rb', battleReports.userReport);

botHears('rbg', battleReports.guildReport);
botHears('rbg[ _]([^ ]+)', battleReports.guildReport);
botHears('rbgw[ _](\\d+)', battleReports.guildReport);

/*
Other
 */

botHears('settings', settings);
botHears('set[_ ]([^ _]+)[_ ](.+)', ss.setValue);

bot.on('message', require('./middleware/message').default);


function hearsRe(command) {

  return new RegExp(`^/${command}($|@${BOT_USER_NAME}$)`, 'i');

}

function botHears(command, mw) {
  bot.hears(hearsRe(command), mw);
}

function botMessage(mw) {
  bot.on('message', mw);
}
