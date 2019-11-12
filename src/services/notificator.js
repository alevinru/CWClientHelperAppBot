import lo from 'lodash';
// import fp from 'lodash/fp';

import { mapSeriesAsync } from 'sistemium-telegram/services/async';

import log from './log';
import Deal from '../models/Deal';
import User from '../models/User';

import { addTraderFunds } from './trading';
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

    this.debouncedHook = lo.debounce(() => this.hookUsers(), 1000);

    User.watch()
      .on('change', this.debouncedHook);

    Deal.watch()
      .on('change', change => {

        const { fullDocument: deal } = change;
        this.notifyDeal(deal).catch(error);

      });
  }

  async notifyDeal(deal) {

    const { buyerName, buyerCastle, sellerId } = deal;
    const user = lo.find(this.users, { cwId: sellerId });

    if (!user) {
      return;
    }

    const { tgId } = user;
    const { item, qty, price } = deal;

    const funds = addTraderFunds(tgId, price * qty);

    const msg = [
      `${price * qty} 💸 <b>${item}</b> ${qty} x ${price}💰`,
      ` to ${buyerCastle} ${buyerName}`,
      funds && ` 💰${funds}`,
    ];

    await notify(tgId, lo.filter(msg).join(''));

  }

  async hookUsers() {
    try {

      const users = await User.find({ [`botSettings.${BOT_ID}.${NOTIFY_SALES}`]: true });

      const ids = await mapSeriesAsync(users, async ({ id: tgId }) => {
        const session = await getSession(BOT_ID, tgId);
        const cwId = lo.get(session, 'auth.id');
        if (!cwId) {
          return false;
        }
        return { cwId, tgId };
      });

      this.users = lo.filter(ids);

      debug('hookUsers', this.users.length);

    } catch (e) {
      error('hookUsers', e);
    }
  }

}

async function notify(userId, msg) {
  debug('notify', userId, msg.replace(/\n/g, ' '));
  const options = { parse_mode: 'HTML', disable_notification: true };
  return bot.telegram.sendMessage(userId, msg, options);
}
