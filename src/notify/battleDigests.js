import { eachSeriesAsync } from 'sistemium-telegram/services/async';

import { battleView } from '../middleware/battles';
import { battleDate } from '../services/battles';
import Battle from '../models/Battle';
import Chat from '../models/Chat';
import log from '../services/log';

const { debug, error } = log('battleDigests');

export default class BattleDigests {

  constructor({ bot, botId }) {
    this.bot = bot;
    this.botId = botId;
  }

  async init() {

    const chats = await this.chatsToNotify();

    debug('init', chats.length);

    this.battleWatch = Battle.watch()
      .on('change', ({ operationType, fullDocument }) => {
        debug(operationType);
        return operationType === 'insert' && this.onBattle(fullDocument);
      });

  }

  chatsToNotify() {
    return Chat.find({ 'setting.notifyBattle': true, botId: this.botId });
  }

  async notifyBattle(battle) {
    const msg = battleView(battle).join('\n');
    const chats = await this.chatsToNotify();
    debug('notifyBattle', chats.length);
    await eachSeriesAsync(chats, async chat => {
      await this.notify(chat.id, msg);
    });
  }

  onBattle(battle) {
    const now = battleDate(new Date());
    if (now > battle.date) {
      debug('ignore', battle.date);
      return;
    }
    this.notifyBattle(battle)
      .catch(error);
  }

  async notify(userId, msg) {
    debug('notify', userId, msg.length);
    const options = { parse_mode: 'HTML', disable_notification: true, disable_web_page_preview: true };
    return this.bot.telegram.sendMessage(userId, msg, options)
      .catch(async err => {
        error('notify:sendMessage', userId, err.message);
        if (/403/.test(err.message)) {
          await Chat.saveValue(userId, 'notifyBattle', false);
          error('notify:sendMessage', 'turn off notifyBattle for', userId);
        }
      });
  }

}
