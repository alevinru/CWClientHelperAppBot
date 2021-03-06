import map from 'lodash/map';
import filter from 'lodash/filter';
// import set from 'lodash/set';

import fpMap from 'lodash/fp/map';
import * as CW from 'cw-rest-api';
import { whilstAsync } from 'sistemium-telegram/services/async';

import { settingValue, NOTIFY_ORDER_FAIL } from './users';
import * as redis from './redis';
import { refreshProfile } from './auth';
import { cw } from './cw';
import bot from './bot';
import log from './log';

const { debug, error } = log('trading');

const TRADERS_PREFIX = 'traders';

const TRADERS_BY_ID = {};

const DEAL_REPEAT_TIME = parseInt(process.env.DEAL_REPEAT_TIME, 0) || 500;
const DEAL_MAX_REPEAT = parseInt(process.env.DEAL_MAX_REPEAT, 0) || 1;

export function getCachedTrader(userId) {
  return TRADERS_BY_ID[userId];
}

export function addTraderFunds(userId, gold) {
  const trader = TRADERS_BY_ID[userId];
  if (!(trader)) {
    return null;
  }
  const { funds = 0 } = trader;
  const newFunds = funds + gold;
  trader.funds = newFunds;
  return newFunds;
}

export async function refreshTraderCache(userId) {

  const trader = await redis.hgetAsync(TRADERS_PREFIX, userId)
    .then(res => {
      if (!res) return { id: userId };
      return JSON.parse(res);
    });
  const profile = await refreshProfile(userId);
  const { gold } = profile;

  TRADERS_BY_ID[userId] = Object.assign(trader, { profile, funds: gold });

  return trader;

}

export async function getTraders() {

  const traders = await redis.hgetallAsync(TRADERS_PREFIX).then(fpMap(JSON.parse));

  const reallyTraders = filter(traders, 'priority');

  debug('getTraders', traders.length);

  return Promise.all(map(reallyTraders, trader => refreshTraderCache(trader.id)));

}

export async function grantTrading(userId, priority) {

  const trader = await refreshTraderCache(userId);

  trader.priority = parseInt(priority, 0);

  return saveTrader(trader);

}

async function saveTrader(trader) {

  await redis.hsetAsync(TRADERS_PREFIX, trader.id, JSON.stringify(trader));

  return trader;
}

function checkDeal(offer, order) {

  if (offer.price > order.price) {
    // debug('offer:ignore:price', offer.price, offer.item, order.price);
    return false;
  }

  let quantity = order.qty > offer.qty ? offer.qty : order.qty;

  const { funds } = getCachedTrader(order.userId);

  const shortage = quantity * offer.price - funds;

  if (shortage > 0) {
    quantity -= Math.ceil(shortage / offer.price);
  }

  if (quantity <= 0) {
    // debug('offer:ignore:funds', funds, offer.item, offer.price);
    postUpdate(order.userId, 10);
    return false;
  }

  return {
    quantity,
    itemCode: order.itemCode,
    price: offer.price,
    exactPrice: true,
  };

}

export async function onGotOffer(offer, order) {

  let tries = 1;
  const deal = checkDeal(offer, order);

  if (!deal) {
    return;
  }

  try {

    const { userId } = order;

    await cw.wantToBuy(userId, deal, order.token)
      .catch(e => {

        if (e !== CW.CW_RESPONSE_NO_OFFERS) {
          return Promise.reject(e);
        }

        return retry(userId);

      });

    replyOrderSuccess(offer, order, deal, tries);

    postUpdate(userId, 5);

  } catch (e) {

    if (e === CW.CW_RESPONSE_USER_BUSY) {
      debug('consumeOffers', `/order_${order.id}`, e);
      return;
    }

    if (e === CW.CW_RESPONSE_NO_FUNDS) {
      postUpdate(order.userId, 0);
    }

    replyOrderFail(e, offer, order, deal, tries)
      .catch(error);

  }

  async function retry(userId) {

    let orderFulfilled = false;

    let repeatTime = DEAL_REPEAT_TIME;

    return whilstAsync(() => !orderFulfilled, async () => {

      debug('onGotOffer attempt', tries, repeatTime);

      await cw.wantToBuy(userId, deal, order.token)
        .then(() => {
          orderFulfilled = true;
        })
        .catch(e => {

          if (e !== CW.CW_RESPONSE_NO_OFFERS || tries > DEAL_MAX_REPEAT) {
            return Promise.reject(e);
          }

          tries += 1;

          return new Promise(done => setTimeout(done, repeatTime));

        });

      repeatTime += DEAL_REPEAT_TIME;

    });

  }

}

const pendingUpdates = {};

function postUpdate(userId, seconds) {

  const pending = pendingUpdates[userId];

  if (pending) {
    clearTimeout(pending);
  }

  const update = () => reportUpdatedFunds(userId)
    .then(() => delete pendingUpdates[userId]);

  pendingUpdates[userId] = setTimeout(update, seconds * 1000);

}

async function reportUpdatedFunds(userId) {

  try {

    const { funds: currentFunds } = getCachedTrader(userId);
    const trader = await refreshTraderCache(userId);

    if (trader && trader.funds !== currentFunds) {

      const reply = `You have ${trader.funds}💰 now`;

      await botMessage(userId, reply);

    } else {
      debug('reportUpdatedFunds', `same ${currentFunds}💰`);
    }

  } catch ({ name, message }) {
    error('reportUpdatedFunds', name, message);
  }

}


async function replyOrderFail(e, offer, order, deal) {

  const { name = 'Error', message = JSON.stringify(e) } = e;
  const { item: itemName, sellerName, qty } = offer;

  const wtb = `/wtb_${order.itemCode}_${deal.quantity}_${offer.price}`;

  const errMsg = [
    `⚠️ Missed ${qty} x ${offer.price}💰`,
    ` of <b>${itemName}</b> from ${offer.sellerCastle} <b>${sellerName}</b>\n`,
    `/order_${order.id} ${name.toLocaleLowerCase()}: <b>${message}</b>\n`,
    `Retry ${wtb}`,
  ];

  const { userId } = order;

  const notify = await settingValue(userId, NOTIFY_ORDER_FAIL);

  if (notify) {
    botMessage(userId, errMsg.join(''))
      .catch(errBot => error('replyOrderFail', errBot.message));
  }

  error('consumeOffers', name, message);

}

function replyOrderSuccess(offer, order, dealParams, tries) {

  debug('replyOrderSuccess:', dealParams);

  const { item: itemName, sellerName, qty } = offer;

  const reply = [
    `✅ Got <b>${itemName}</b> ${dealParams.quantity} x ${dealParams.price}💰`,
    qty > dealParams.quantity ? `of <b>${qty}</b> ` : '',
    `from ${offer.sellerCastle} <b>${sellerName}</b>`,
    `by /order_${order.id}`,
  ];

  if (tries > 1) {
    reply.push(`on attempt №${tries}`);
  }

  botMessage(order.userId, filter(reply).join(' '))
    .catch(({ name, message }) => error('onGotOffer', name, message));

}


export async function setTraderActive(traderId, isActive) {

  const trader = getCachedTrader(traderId);

  if (!trader) {
    return false;
  }

  trader.isPaused = !isActive;

  return saveTrader(trader);

}

async function botMessage(userId, reply) {
  const options = { parse_mode: 'HTML', disable_notification: true };
  return bot.telegram.sendMessage(userId, reply, options);
}
