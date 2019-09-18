import Telegraf from 'telegraf';

import bot, { botHears } from './services/bot';
import { fromCWFilter } from './config/filters';

import * as auth from './middleware/auth';

import wtb from './middleware/wtb';

import * as trades from './middleware/trades';
import * as ord from './middleware/order';
import * as traders from './middleware/traders';
import * as users from './middleware/hello';
import * as battleReports from './middleware/battleReports';
import * as battles from './middleware/battles';
import * as chat from './middleware/chat';
import * as mobs from './middleware/mobs';

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
botHears('trading', traders.tradingStatus);
botHears('trading[ _]help', traders.tradingHelp);
botHears('trading[ _](on|off)', traders.tradingActive);
botHears('trading[ _](on|off)[ _](\\d+)', traders.tradingActive);

bot.hears(/^\/trades[ _]([a-z0-9]+)$/, trades.itemTrades);

bot.hears(/^\/traders$/, traders.traders);
bot.hears(/^\/grant[ _]trading[ _](\d*)[ ]?(\d*)$/, traders.grantTrading);

bot.hears(/^\/t[_ ]?([a-z0-9]{1,2}\d+)[ _]?(\d+)?([hm])?$/, trades.itemStats);

const who = [
  '(who|whos)(p?)[_ ]?([a-z0-9]{1,2}\\d+)',
  '[ _]([><=]{0,2})(\\d+)[ _](\\d+)([hmdw])?',
];
botHears(who.join(''), trades.itemBuyers);

/*
Orders
 */

function hearsOrders(match, mw) {
  botHears(match, Telegraf.compose([ord.checkTraderAuth, mw]));
}

hearsOrders('orders_top', ord.ordersTop);
hearsOrders('order[ _]([a-z0-9]+)[ _](\\d+)[ _](\\d+)[ ]?(\\d*)', ord.createOrder);
hearsOrders('orders[ _]([a-z0-9]+)', ord.orders);
hearsOrders('orders', ord.userOrders);

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
bot.command('authStock', auth.authStock);
bot.hears(/^\/hello[ _](\d+)$/, users.hello);
bot.command('hello', users.hello);
botHears('users', users.listUsers);
botHears('gg', users.listUsers);

bot.hears(/^\/(trust|untrust)$/, users.trust);

/*
Chats
 */

botHears('chat[ _]set[ _]([a-z]+)[ _](on|off)', chat.setting);
botHears('chat[ _]get[ _]([a-z]+)', chat.viewSetting);

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
botHears('ba[ _]([\\d]{6})[ _]([\\d]{2})', battles.showBattleByCode);
botHears('ba', battles.showLastBattle);


botMessage(Telegraf.optional(battleReports.reportFilter, battleReports.onReportForward));

botHears('rb', battleReports.userReportForPeriod);
botHears('rb[ _](\\d{1,4})[ _](\\d{1,4})', battleReports.userReportForPeriod);
botHears('rb[ _](\\d{1,4})', battleReports.userReportForPeriod);

botHears('rb[ _]([\\da-h]{24})', battleReports.userReport);
botHears('bm[ _]([\\da-h]{24})[ _](.+)', battles.setMaster);

botHears('rbg', battleReports.guildReport);
botHears('rbg[ _]([^ ]+)', battleReports.guildReport);
botHears('rbgw[ _](\\d+)', battleReports.guildReport);

/*
Mobs
 */

botMessage(Telegraf.optional(mobs.metMobFilter, mobs.onMobForward));
bot.action(/mob_helping/, mobs.onHelpingClick);
/*
Other
 */

botHears('settings', settings);
botHears('set[_ ]([^ _]+)[_ ](.+)', ss.setValue);

bot.on('message', require('./middleware/message').default);


function botMessage(mw) {
  bot.on('message', mw);
}
