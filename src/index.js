import Telegraf from 'telegraf';

const debug = require('debug')('laa:cwb:index');

const { BOT_TOKEN } = process.env;
const bot = new Telegraf(BOT_TOKEN);

debug('Started bot id:', BOT_TOKEN.match(/^[^:]*/)[0]);

/** Middleware
 * */

bot.command('auth', require('./middleware/auth').default);
bot.command('profile', require('./middleware/profile').default);
bot.command('stock', require('./middleware/stock').default);

bot.hears(/^\/wtb[ _](.+)[ _](.+)[ _](.+)$/, require('./middleware/wtb').default);

bot.on('message', require('./middleware/message').default);

bot.startPolling();

/** Exception handlers
 * */

bot.catch(err => {
  Telegraf.reply('Something went wrong, i don\'t know how it happened');
  debug('catch:', err);
});
