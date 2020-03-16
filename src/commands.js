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
import * as alliances from './middleware/alliances';
import * as chat from './middleware/chat';
import * as mobs from './middleware/mobs';

import start from './middleware/start';
import * as stock from './middleware/stock';
import profile, { guildInfo, craftBook } from './middleware/profile';
import gearInfo, * as gear from './middleware/gear';

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
  '(who|whos)(p?)(c?)[_ ]?([a-z0-9]{1,2}\\d+)',
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
hearsOrders('orders[ _]([a-z0-9]+)', ord.ordersByItem);
hearsOrders('orders', ord.userOrders);

hearsOrders('order[ _]([a-z0-9]+)', ord.orderById);
hearsOrders('rmorder[ _]([a-z0-9]+)', ord.rmById);
hearsOrders('saorder[ _]([a-z0-9]+)', ord.setOrderActive);

/*
Users
 */

bot.command('start', start);
bot.command('auth', auth.auth);
bot.command('authProfile', auth.authGetProfile);
bot.command('authGuild', auth.authGuildInfo);
bot.command('authCraftBook', auth.authCraftBook);
bot.command('authGear', auth.authGearInfo);
bot.command('authStock', auth.authStock);
bot.command('authBuy', auth.authBuy);

bot.hears(/^\/hello[ _](\d+)$/, users.hello);
bot.command('hello', users.hello);
botHears('users', users.listUsers);
botHears('gg', users.listUsers);
botHears('gg[ _]([a-z]+)', gear.guildGear);
const ghp = 'g[ _](hp|gold|stamina|pouches|exp|mana|event_[a-z]+)';
botHears(`${ghp}[ _](\\d+)(K)?`, users.guildHp);
botHears(ghp, users.guildHp);


bot.hears(/^\/(trust|untrust)$/, users.trust);

botHears('castles', users.castles);
botHears('classes', users.classes);

/*
Chats
 */

botHears('chat[ _]set[ _]([a-z]+)[ _](on|off|\\d+)', chat.setting);
botHears('chat[ _]get[ _]([a-z]+)', chat.viewSetting);
botHears('chat[ _]settings', chat.viewSettings);

/*
ChatWars
 */

botHears('stock[ _]?(\\d*)', stock.stockInfo);
botHears('potions', stock.potionsInfo);
botHears('gp', stock.guildPotionsInfo);

botHears('profile[ _]?(\\d*)', profile);
botHears('gear[ _]?(\\d*)', gearInfo);
botHears('hat', gear.hat);

botHears('gi[ _](.+)', guildInfo);
bot.command('gi', guildInfo);

botHears('(craftBook|cb)[ _](.+)', craftBook);
botHears('(craftBook|cb)', craftBook);

botHears('wtb[ _]([a-z0-9]+)[ _](\\d+)[ _](\\d+)[ ]?(\\d*)', wtb);

botHears('wf[ _]([a-z _0-9]+)', shops.shopsByItem);
botHears('wf (/.+/)', shops.shopsByItem);

botHears('ws[r]?_([a-z0-9]+)', shops.shopInfo);
botHears('mnt[ _]([a-z]+)', shops.maintenanceShops);
bot.command('mnt', shops.maintenanceShops);
botHears('guru[ _](\\d)', shops.guruShops);
botHears('guru[ _]([a-z]{1,10})[ _]?(\\d)?', shops.guruSpecialShops);
botHears('guru', shops.guruShops);

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
// botHears('du[ _](\\d{6,6})', ownArena);

/*
Battles
 */

botMessageIf(battles.reportFilter, battles.onReportForward);
botHears('ba[ _]([\\d]{6})[ _]([\\d]{2})', battles.showBattleByCode);
botHears('ba', battles.showLastBattle);

botMessageIf(battleReports.reportFilter, battleReports.onReportForward);

botHears('rb', battleReports.userReportForPeriod);
botHears('rb[ _](\\d{1,4})[ _](\\d{1,4})', battleReports.userReportForPeriod);
botHears('rb[ _](\\d{1,4})', battleReports.userReportForPeriod);

botHears('rb[ _]([\\da-h]{24})', battleReports.userReport);
botHears('bm[ _]([\\da-h]{24})[ _](.+)', battles.setMaster);

botHears('rbg[ _]([^ ]+)', battleReports.guildReport);
botHears('rbg', battleReports.guildReport);
botHears('rbgw[ _](\\d+)', battleReports.guildReport);

/*
Alliances
 */

botHears('ab[ _]([\\d]{6})[ _]([\\d]{2})', alliances.showAllianceBattleByCode);
botHears('ab', alliances.showLastAllianceBattle);

botMessageIf(alliances.tasksFilter, alliances.parseTasks);
botMessageIf(alliances.foundObjectiveFilter, alliances.parseFoundLocation);
botMessageIf(alliances.foundHeadquarterFilter, alliances.parseFoundHeadquarter);

const { authAlliances } = alliances;

botHearsIf(authAlliances, 'alliances', alliances.showAlliances);
botHearsIf(authAlliances, 'af[ _]([\\da-z]{6})', alliances.showAllianceByCode);
botHearsIf(authAlliances, 'af[ _](.{2,3})', alliances.showAllianceByTag);
botHearsIf(authAlliances, 'af ([a-z]+ [a-z]+)', alliances.showAllianceByName);
botHearsIf(authAlliances, 'ga_atk[ _]([\\da-z]{6})', alliances.showAllianceByCode);
botHearsIf(authAlliances, 'ga_locations', alliances.showLocations);

/*
Mobs
 */

botMessage(Telegraf.optional(mobs.metMobFilter, mobs.onMobForward));
bot.action(/mob_helping/, mobs.onHelpingClick);

botHears('fight_[0-9a-z]+', mobs.showMobFight);
botHears('helpers[ _](\\d\\d)([ _]silent)?', users.usersToPin);
botHears('helpers[ _]?(silent|show)?', users.usersToPin);

/*
Other
 */

botHears('settings', settings);
botHears('set[_ ]([^ _]+)[_ ](.+)', ss.setValue);

bot.on('message', require('./middleware/message').default);


function botMessage(mw) {
  bot.on('message', mw);
}

function botMessageIf(filter, mw) {
  botMessage(Telegraf.optional(filter, mw));
}

function botHearsIf(filter, command, mw) {
  botHears(command, Telegraf.optional(filter, mw));
}
