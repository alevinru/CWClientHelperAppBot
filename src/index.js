import { cw } from './services';
import log from './services/log';
import { getTraders } from './services/trading';
import session from './services/session';
import bot, { BOT_ID, BOT_USER_NAME, exceptionHandler } from './services/bot';
import * as mongo from './models';

import Notificator from './services/notificator';
import BattleDigests from './notify/battleDigests';

const { debug, error } = log('index');

require('./config/context').default(bot);

/*
Low level middleware
*/

bot.use(exceptionHandler);
bot.use(session({ botId: BOT_ID }).middleware());

require('./commands');

cw.connect({ timeout: process.env.CW_TIMEOUT })
  .then(run);

async function run() {

  await mongo.connect();
  await bot.startPolling();
  await getTraders();

  const notificator = new Notificator();

  await notificator.init();

  const battleDigests = new BattleDigests({ bot, botId: BOT_ID });

  await battleDigests.init();

  debug('Start polling', BOT_USER_NAME);

}


/*
Exception handlers
*/


bot.catch(({ name, message }) => {
  error(name, message);
});


process.on('SIGTERM', () => {
  const { REPORT_CHAT_ID, SIGTERM_MESSAGE } = process.env;
  if (!REPORT_CHAT_ID) {
    return;
  }
  bot.telegram.sendMessage(REPORT_CHAT_ID, SIGTERM_MESSAGE || 'Stopping')
    .catch(error);
});
