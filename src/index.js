import Telegraf from 'telegraf';

const debug = require('debug')('laa:cwb:index');

const { BOT_TOKEN } = process.env;
const bot = new Telegraf(BOT_TOKEN);

debug('Started bot id:', BOT_TOKEN.match(/^[^:]*/)[0]);

/** Middleware
 * */

bot.command('auth', require('./middleware/auth').default);

bot.hears(/^\/wtb[ _](.+)[ _](.+)[ _](.+)$/, require('./middleware/wtb').default);

bot.on('message', require('./middleware/message').default);

bot.startPolling();

/** Exception handlers
 * */

bot.catch(err => {
  debug('catch:', err);
});
