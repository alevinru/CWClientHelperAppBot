import log from '../services/log';
import bot, {
  BOT_ID, BOT_USER_NAME, exceptionHandler, botHears,
} from '../services/bot';
import * as mongo from '../models';

import BattleDigests from '../notify/battleDigests';
import * as mw from './start';
import * as battles from '../middleware/battles';
import * as chat from '../middleware/chat';

const { debug, error } = log('digests');


botHears('chat[ _]set[ _]([a-z]+)[ _](on|off)', chat.setting);
botHears('chat[ _]get[ _]([a-z]+)', chat.viewSetting);

bot.on('new_chat_members', mw.onNewMember);
bot.on('left_chat_member', mw.onLeftMember);
bot.on('migrate_to_chat_id', mw.onChatMigratedTo);
bot.on('migrate_from_chat_id', mw.onChatMigratedFrom);
bot.on('group_chat_created', mw.onChatCreated);

bot.on('supergroup_chat_created', ({ update: { message } }) => {
  error('supergroup_chat_created', message);
});

botHears('ba[ _]([\\d]{6})[ _]([\\d]{2})', battles.showBattleByCode);
botHears('ba', battles.showLastBattle);

run().catch(error);

async function run() {

  bot.use(exceptionHandler);
  bot.command('start', mw.start);

  await mongo.connect();
  await bot.startPolling();

  const battleDigests = new BattleDigests({ bot, botId: BOT_ID });
  await battleDigests.init();

  debug('Start polling', BOT_USER_NAME);

}


bot.catch(({ name, message }) => {
  error(name, message);
});
