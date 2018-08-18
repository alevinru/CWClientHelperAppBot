// import { cw, getAuthToken } from '../services';
import { pricesByItemCode } from '../services/cw';

const debug = require('debug')('laa:cwb:trades');

export default async function (ctx) {

  const {
    match,
  } = ctx;
  const [, itemCode] = match;
  const command = `/trades_${itemCode}`;

  debug(command, itemCode);

  try {
    const prices = await pricesByItemCode(itemCode);
    const reply = [
      `Last digest prices are: <b>${JSON.stringify(prices)}</b>`,
      `So, max wtb price is <b>${prices[0] || 'unknown'}</b>💰`,
    ];
    await ctx.replyHTML(reply.join('\n'));
  } catch (e) {
    ctx.replyError(command, e);
  }

}

export async function dealLimit(itemCode) {
  const prices = await pricesByItemCode(itemCode);
  return prices && prices[0];
}

export async function checkPrice(itemCode, price) {

  const maxPrice = await dealLimit(itemCode);

  if (maxPrice < price) {
    throw new Error(`Price is higher than limit of ${maxPrice}💰`);
  }

}
