import filter from 'lodash/filter';
import sumBy from 'lodash/sumBy';
import map from 'lodash/map';
import groupBy from 'lodash/groupBy';
import round from 'lodash/round';
import addHours from 'date-fns/add_hours';
import log from '../services/log';
import { lrangeAsync } from '../services/redis';
import { dealsKey } from '../consumers/dealsConsumer';
import { pricesByItemCode, itemNameByCode } from '../services/cw';

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

export async function itemStats(ctx) {

  const { match } = ctx;
  const hours = 24;
  const [command, itemCode] = match;
  const itemName = itemNameByCode(itemCode);

  debug(command, itemCode, itemName || 'unknown itemCode');

  if (!itemName) {
    await ctx.replyWithHTML(`Unknown item code <b>${itemCode}</b>`);
    return;
  }

  const lastDay = addHours(new Date(), -hours).toISOString();

  const data = await lrangeAsync(dealsKey(itemCode), 0, -1);
  const allDeals = data && data.map(JSON.parse);
  const deals = filter(allDeals, ({ ts }) => ts > lastDay);

  if (!deals.length) {
    await ctx.replyHTML(`No deals on <b>${itemName}</b> in last <b>${hours}</b> hours`);
    return;
  }

  const totalSum = sumBy(deals, ({ price, qty }) => price * qty);
  const totalQty = sumBy(deals, 'qty');

  const byPrice = groupBy(deals, 'price');

  const res = [
    `<b>${itemNameByCode(itemCode)}</b> market in last <b>${hours}</b> hours:\n`,
    `Total deals: ${deals.length}`,
    `Turnover: ${totalSum}💰= ${totalQty} x ${round(totalSum / totalQty, 2)}💰`,
  ];

  const priceBreakdown = map(byPrice, (priceDeals, price) => ({
    price,
    qty: sumBy(priceDeals, 'qty'),
  }));

  res.push('Price breakdown:');

  priceBreakdown.forEach(({ price, qty }) => {
    res.push(`${price}💰x ${qty}`);
  });

  await ctx.replyWithHTML(res.join('\n'));

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
