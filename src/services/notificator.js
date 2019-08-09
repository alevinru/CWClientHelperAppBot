import lo from 'lodash';
// import fp from 'lodash/fp';

import { mapSeriesAsync } from 'sistemium-telegram/services/async';

import log from './log';
import Deal from '../models/Deal';
import User from '../models/User';

import { getSession } from './session';
import bot, { BOT_ID } from './bot';

import { NOTIFY_SALES } from './users';

const { debug, error } = log('notificator');

export default class Notificator {

  constructor() {
    this.users = [];
  }

  async init() {

    await this.hookUsers();

    User.watch()
      .on('change', () => this.hookUsers());

    Deal.watch()
      .on('change', change => {

        const { fullDocument: deal } = change;

        const { buyerName, buyerCastle, sellerId } = deal;
        const { item, qty, price } = deal;

        const msg = [
          `🤝 <b>${item}</b> ${qty} x ${price}💰`,
          `to ${buyerCastle} ${buyerName}`,
        ].join(' ');

        // debug(operationType, msg);

        this.notifyDeal(sellerId, msg).catch(error);

      });
  }

  async notifyDeal(cwId, msg) {
    const user = lo.find(this.users, { cwId });
    if (!user) {
      return;
    }
    await notify(user.tgId, msg);
  }

  async hookUsers() {
    try {

      const users = await User.find({ [`settings.${NOTIFY_SALES}`]: true });
      debug('hookUsers', users.length);

      const ids = await mapSeriesAsync(users, async ({ id: tgId }) => {
        const session = await getSession(BOT_ID, tgId);
        const cwId = lo.get(session, 'auth.id');
        if (!cwId) {
          return false;
        }
        return { cwId, tgId };
      });

      this.users = lo.filter(ids);

    } catch (e) {
      error('hookUsers', e);
    }
  }

}

async function notify(userId, msg) {
  debug('notify', userId, msg);
  const options = { parse_mode: 'HTML', disable_notification: true };
  return bot.telegram.sendMessage(userId, msg, options);
}
