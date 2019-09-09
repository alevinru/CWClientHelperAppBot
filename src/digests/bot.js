import log from '../services/log';
import bot, {
  BOT_ID, BOT_USER_NAME, exceptionHandler, botHears,
} from '../services/bot';
import * as mongo from '../models';

import BattleDigests from '../notify/battleDigests';
import { start, onNewMember, onLeftMember } from './start';
import * as chat from '../middleware/chat';

const { debug, error } = log('digests');


botHears('chat[ _]set[ _]([a-z]+)[ _](on|off)', chat.setting);
botHears('chat[ _]get[ _]([a-z]+)', chat.viewSetting);

bot.on('new_chat_members', onNewMember);
bot.on('left_chat_member', onLeftMember);

run().catch(error);

async function run() {

  bot.use(exceptionHandler);
  bot.command('start', start);

  await mongo.connect();
  await bot.startPolling();

  const battleDigests = new BattleDigests({ bot, botId: BOT_ID });
  await battleDigests.init();

  debug('Start polling', BOT_USER_NAME);

}


bot.catch(({ name, message }) => {
  error(name, message);
});
