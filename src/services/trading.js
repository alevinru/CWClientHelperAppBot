import map from 'lodash/map';
import fpMap from 'lodash/fp/map';
import * as CW from 'cw-rest-api';
import * as redis from './redis';
import { refreshProfile } from './auth';
import { cw } from './cw';
import bot from './bot';
import log from '../services/log';

const { debug, error } = log('trading');

const TRADERS_PREFIX = 'traders';

const TRADERS_BY_ID = {};

export function getCachedTrader(userId) {
  return TRADERS_BY_ID[userId];
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

  // debug('getTraders', traders);

  return Promise.all(map(traders, trader => refreshTraderCache(trader.id)));

}

export async function grantTrading(userId) {

  const trader = await refreshTraderCache(userId);

  await redis.hsetAsync(TRADERS_PREFIX, userId, JSON.stringify(trader));

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

  try {

    const deal = checkDeal(offer, order);

    if (!deal) {
      return;
    }

    const { userId } = order;

    await cw.wantToBuy(userId, deal, order.token);

    replyOrderSuccess(offer, order, deal);

    postUpdate(userId, 5);

  } catch (e) {

    if (e === CW.CW_RESPONSE_USER_BUSY) {
      debug('consumeOffers', `/order_${order.id}`, e);
      return;
    }

    if (e === CW.CW_RESPONSE_NO_FUNDS) {
      postUpdate(order.userId, 0);
    }

    replyOrderFail(e, offer, order);

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

      await bot.telegram.sendMessage(userId, reply, { parse_mode: 'HTML' });

    } else {
      debug('reportUpdatedFunds', `same ${currentFunds}💰`);
    }

  } catch ({ name, message }) {
    error('reportUpdatedFunds', name, message);
  }

}


function replyOrderFail(e, offer, order) {

  const { name = 'Error', message = e } = e;
  const { item: itemName, sellerName, qty } = offer;

  const errMsg = [
    `⚠️ Missed ${qty} x ${offer.price}💰`,
    ` of <b>${itemName}</b> from <b>${sellerName}</b>\n`,
    `/order_${order.id} deal failed with`,
    ` ${name.toLocaleLowerCase()}: <b>${message}</b>.`,
  ];

  bot.telegram.sendMessage(order.userId, errMsg.join(''), { parse_mode: 'HTML' })
    .catch(errBot => error('replyOrderFail', errBot.message));

  error('consumeOffers', name, message);

}

function replyOrderSuccess(offer, order, dealParams) {

  debug('replyOrderSuccess:', dealParams);

  const { item: itemName, sellerName, qty } = offer;

  const reply = [
    `✅ Got <b>${itemName}</b> ${dealParams.quantity} x ${dealParams.price}💰`,
    ` of <b>${qty}</b> from <b>${sellerName}</b>`,
    ` by /order_${order.id}`,
  ];

  bot.telegram.sendMessage(order.userId, reply.join(''), { parse_mode: 'HTML' })
    .catch(({ name, message }) => error('onGotOffer', name, message));

}
