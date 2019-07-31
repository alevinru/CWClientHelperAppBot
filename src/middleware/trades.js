import sumBy from 'lodash/sumBy';
import round from 'lodash/round';
import take from 'lodash/take';
import orderBy from 'lodash/orderBy';
import addHours from 'date-fns/add_hours';
import addMinutes from 'date-fns/add_minutes';
import log from '../services/log';
import Deal from '../models/Deal';
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
  const [command, itemCode, hoursParam, hm = 'h'] = match;
  const itemName = itemNameByCode(itemCode);

  debug(command, itemCode, hoursParam, itemName || 'unknown itemCode');

  const hours = parseInt(hoursParam, 0) || 24;

  if (!itemName) {
    await ctx.replyWithHTML(`Unknown item code <b>${itemCode}</b>`);
    return;
  }

  const add = hm === 'h' ? addHours : addMinutes;

  const dealsFilter = {
    ts: { $gt: add(new Date(), -hours) },
    itemCode,
  };

  const pipeline = [
    { $match: dealsFilter },
    {
      $group: {
        _id: '$price',
        qty: { $sum: '$qty' },
        cnt: { $sum: 1 },
      },
    },
    { $addFields: { price: '$_id' } },
  ];

  const data = await Deal.aggregate(pipeline);
  const deals = orderBy(data, 'price');
  const hms = `${hm === 'h' ? 'hour' : 'minute'}${hours > 1 ? 's' : ''}`;

  if (!deals.length) {
    await ctx.replyHTML(`No deals on <b>${itemName}</b> in last <b>${hours}</b> ${hms}`);
    return;
  }

  const totalSum = sumBy(deals, ({ price, qty }) => price * qty);
  const totalQty = sumBy(deals, 'qty');

  const res = [
    `<b>${itemNameByCode(itemCode)}</b> market in last <b>${hours}</b> ${hms}:\n`,
    `Total deals: ${sumBy(deals, 'cnt')}`,
    `Turnover: ${totalSum}💰= ${totalQty} x ${round(totalSum / totalQty, 2)}💰`,
  ];

  if (deals.length > 1) {
    res.push('');
    deals.forEach(({ price, qty }) => {
      res.push(`${price}💰x ${qty}`);
    });
  }

  await ctx.replyWithHTML(res.join('\n'));

}

const NAMES_LIMIT = 12;

export async function itemBuyers(ctx) {

  const { match } = ctx;
  const [command, itemCode, priceParam, hoursParam, hm = 'h'] = match;
  const itemName = itemNameByCode(itemCode);

  debug(command, itemCode, priceParam, hoursParam, itemName || 'unknown itemCode');

  const hours = parseInt(hoursParam, 0) || 1;

  if (!itemName) {
    await ctx.replyWithHTML(`Unknown item code <b>${itemCode}</b>`);
    return;
  }

  const dealsPrice = parseInt(priceParam, 0);

  if (!dealsPrice) {
    await ctx.replyWithHTML('You must specify price');
    return;
  }

  const add = hm === 'h' ? addHours : addMinutes;

  const dealsFilter = {
    ts: { $gt: add(new Date(), -hours) },
    itemCode,
    price: dealsPrice,
  };

  const pipeline = [
    { $match: dealsFilter },
    {
      $group: {
        _id: '$buyerName',
        qty: { $sum: '$qty' },
        cnt: { $sum: 1 },
      },
    },
    // { $addFields: { price: '$_id' } },
  ];

  const data = await Deal.aggregate(pipeline);
  const deals = orderBy(data, ['qty'], ['desc']);
  const hms = `${hm === 'h' ? 'hour' : 'minute'}${hours > 1 ? 's' : ''}`;

  if (!deals.length) {
    const replyNoDeals = [
      `No deals on <b>${itemName}</b> in last <b>${hours}</b> ${hms}`,
      `for the price of <b>${dealsPrice}</b>`,
    ];
    await ctx.replyHTML(replyNoDeals.join(' '));
    return;
  }

  // const totalSum = sumBy(deals, ({ price, qty }) => price * qty);
  const totalQty = sumBy(deals, 'qty');

  const namesToShow = take(deals, NAMES_LIMIT);

  const res = [
    `<b>${itemNameByCode(itemCode)}</b> deals in last <b>${hours}</b> ${hms}`,
    `for the price of <b>${dealsPrice}</b>:`,
    '',
    ...namesToShow.map(({ _id: name, qty }) => `<code>${name}</code> x <b>${qty}</b>`),
  ];

  if (deals.length > NAMES_LIMIT) {
    const othersQty = totalQty - sumBy(namesToShow, 'qty');
    res.push('', `<b>${deals.length - NAMES_LIMIT}</b> others x <b>${othersQty}</b>`);
  }

  if (deals.length > 1) {
    res.push('', `Total qty: <b>${totalQty}</b>`);
  }

  await ctx.replyWithHTML(res.join('\n'));

}


/**
 * Returns higher limit calculated on given sex_digest data
 * @param {Array} prices
 * @returns {Number}
 */

function minPriceForPrices(prices) {
  return Math.ceil(prices[0] * PRICE_LIMIT_PERCENT);
}

export async function dealLimit(itemCode) {
  const prices = await pricesByItemCode(itemCode);
  return prices && minPriceForPrices(prices);
}

export async function checkPrice(itemCode, price) {

  const maxPrice = await dealLimit(itemCode);

  if (maxPrice > 0 && maxPrice < price) {
    throw new Error(`Price is higher than limit of ${maxPrice}💰`);
  }

}
