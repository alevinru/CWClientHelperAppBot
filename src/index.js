import Telegraf from 'telegraf';
import RedisSession from 'telegraf-session-redis';

const debug = require('debug')('laa:cwb:index');

const { BOT_TOKEN } = process.env;
const bot = new Telegraf(BOT_TOKEN);

const session = new RedisSession({
  store: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    db: process.env.REDIS_DB || 0,
  },
});

bot.use(session.middleware());

debug('Starting bot id:', BOT_TOKEN.match(/^[^:]*/)[0]);

/** Middleware
 * */

bot.command('start', require('./middleware/start').default);
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
