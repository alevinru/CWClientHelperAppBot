import Telegraf from 'telegraf';
import session from './services/session';

const debug = require('debug')('laa:cwb:index');

const { BOT_TOKEN } = process.env;
const bot = new Telegraf(BOT_TOKEN);

debug('Starting bot id:', BOT_TOKEN.match(/^[^:]*/)[0]);

/** Middleware
 * */

bot.use(exceptionHandler);
bot.use(session.middleware());

bot.command('start', require('./middleware/start').default);
bot.command('auth', require('./middleware/auth').default);
bot.command('profile', require('./middleware/profile').default);
bot.command('stock', require('./middleware/stock').default);
bot.on('message', require('./middleware/message').default);

bot.hears(/^\/wtb[ _](.+)[ _](.+)[ _](.+)$/, require('./middleware/wtb').default);

bot.startPolling();

/** Exception handlers
 * */

function exceptionHandler(ctx, next) {

  debug('exceptionHandler', 'start');

  next().catch(({ name, message }) => {
    debug(name, message);
    return ctx.reply(`Error: ${message}`);
  });

}

bot.catch(({ name, message }) => {
  debug(name, message);
});
