import { cw } from './services';
import log from './services/log';
import session from './services/session';
import bot, { BOT_ID } from './services/bot';
import * as mongo from './models';

const { debug, error } = log('index');

require('./config/context').default(bot);

/*
Low level middleware
*/

bot.use(exceptionHandler);
bot.use(session({ botId: BOT_ID }).middleware());

require('./commands');

cw.connect({ timeout: process.env.CW_TIMEOUT })
  .then(() => mongo.connect())
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


process.on('SIGTERM', () => {
  const { REPORT_CHAT_ID, SIGTERM_MESSAGE } = process.env;
  if (!REPORT_CHAT_ID) {
    return;
  }
  bot.telegram.sendMessage(REPORT_CHAT_ID, SIGTERM_MESSAGE || 'Stopping')
    .catch(error);
});
