// import { cw, getAuthToken } from '../services';
import { pricesByItemCode } from '../services/cw';
// import { dropOfferHooks, getOfferHooks } from '../consumers/offersConsumer';
// import { hookOffers } from '../services/ordering';
import log from '../services/log';

const { debug } = log('mw:trades');

const PRICE_LIMIT_PERCENT = 1.2;

export async function itemTrades(ctx) {

  const {
    match,
  } = ctx;
  const [, itemCode] = match;
  const command = `/trades_${itemCode}`;

  debug(command, itemCode);

  try {
    const prices = await pricesByItemCode(itemCode);
    const priceLimit = minPriceForPrices(prices);
    const reply = [
      `Last digest prices are: <b>${JSON.stringify(prices)}</b>`,
      `So, max wtb price is <b>${priceLimit || 'unknown'}</b>💰`,
    ];
    await ctx.replyHTML(reply.join('\n'));
  } catch (e) {
    ctx.replyError(command, e);
  }

}

/**
 * Returns higher limit calculated on given sex_digest data
 * @param {Array} prices
 * @returns {Number}
 */

function minPriceForPrices(prices) {
  return Math.floor(prices[0] * PRICE_LIMIT_PERCENT);
}

export async function dealLimit(itemCode) {
  const prices = await pricesByItemCode(itemCode);
  return prices && minPriceForPrices(prices);
}

export async function checkPrice(itemCode, price) {

  const maxPrice = await dealLimit(itemCode);

  if (maxPrice < price) {
    throw new Error(`Price is higher than limit of ${maxPrice}💰`);
  }

}
