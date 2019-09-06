import { eachSeriesAsync } from 'sistemium-telegram/services/async';

import { battleView } from '../middleware/battles';
import { battleDate } from '../services/battles';
import Battle from '../models/Battle';
import Chat from '../models/Chat';
import bot from '../services/bot';
import log from '../services/log';

const { debug, error } = log('battleDigests');

export default class BattleDigests {

  async init() {

    const chats = await chatsToNotify();

    debug('init', chats.length);

    this.battleWatch = Battle.watch()
      .on('change', ({ operationType, fullDocument }) => {
        debug(operationType);
        return operationType === 'insert' && onBattle(fullDocument);
      });

  }

}

function chatsToNotify() {
  return Chat.find({ 'setting.notifyBattle': true });
}

function onBattle(battle) {
  const now = battleDate(new Date());
  if (now > battle.date) {
    debug('ignore', battle.date);
    return;
  }
  notifyBattle(battle)
    .catch(error);
}

async function notifyBattle(battle) {
  const msg = battleView(battle).join('\n');
  const chats = await chatsToNotify();
  debug('notifyBattle', chats.length);
  await eachSeriesAsync(chats, async chat => {
    await notify(chat.id, msg);
  });
}

async function notify(userId, msg) {
  debug('notify', userId, msg.length);
  const options = { parse_mode: 'HTML', disable_notification: true, disable_web_page_preview: true };
  return bot.telegram.sendMessage(userId, msg, options)
    .catch(err => {
      error('notify:sendMessage', userId, err.message);
    });
}
