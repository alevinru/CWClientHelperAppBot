import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import lo from 'lodash';

import { battleView } from '../middleware/battles';
import { battleDate } from '../services/battles';
import { allianceBattleFullView } from '../services/aliancing';

import Battle from '../models/Battle';
import AllianceBattle from '../models/AllianceBattle';
import AllianceMapState from '../models/AllianceMapState';
import Chat from '../models/Chat';
import log from '../services/log';

const { debug, error } = log('battleDigests');

const TYPE_HQ = 'headquarters';
const TYPE_MS = 'mapState';

export default class BattleDigests {

  constructor({ bot, botId }) {
    this.bot = bot;
    this.botId = botId;
  }

  async init() {

    const chats = await this.chatsToNotify();

    debug('init', chats.length);

    this.allianceReady = {};

    this.battleWatch = Battle.watch()
      .on('change', ({ operationType, fullDocument }) => {
        debug(operationType);
        return operationType === 'insert' && this.onBattle(fullDocument);
      });

    this.allianceWatch = AllianceBattle.watch()
      .on('change', ({ operationType, fullDocument }) => {
        debug('allianceWatch', operationType);
        return operationType === 'insert' && this.onAllianceBattle(fullDocument, TYPE_HQ);
      });

    this.allianceMapWatch = AllianceMapState.watch()
      .on('change', ({ operationType, fullDocument }) => {
        debug('allianceMapWatch', operationType);
        return operationType === 'insert' && this.onAllianceBattle(fullDocument, TYPE_MS);
      });

  }

  chatsToNotify() {
    return Chat.find({ 'setting.notifyBattle': true, botId: this.botId });
  }

  chatsToNotifyAlliance() {
    return Chat.find({ 'setting.notifyAllianceBattle': true, botId: this.botId });
  }

  async notifyBattle(battle) {
    const msg = battleView(battle).join('\n');
    const chats = await this.chatsToNotify();
    debug('notifyBattle', chats.length);
    await eachSeriesAsync(chats, async chat => {
      await this.notify(chat.id, msg);
    });
  }

  async notifyAllianceBattle(date) {
    const reply = await allianceBattleFullView(date);
    const chats = await this.chatsToNotifyAlliance();
    debug('notifyAllianceBattle', chats.length);
    const msg = reply.join('\n');
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

  onAllianceBattle(battle, type) {
    const now = battleDate(new Date());
    if (now > battle.date) {
      debug('ignore', battle.date);
      return;
    }
    this.checkAllianceDigestReady(battle, type);
  }

  checkAllianceDigestReady(battle, type) {
    this.allianceReady[type] = battle;
    const dateHQ = lo.get(this.allianceReady[TYPE_HQ], 'date');
    const dateMS = lo.get(this.allianceReady[TYPE_MS], 'date');
    debug('checkAllianceDigestReady', type, dateMS, dateHQ);
    if (dateHQ && dateMS && dateHQ.getTime() === dateMS.getTime()) {
      this.notifyAllianceBattle(dateMS)
        .catch(error);
    }
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
