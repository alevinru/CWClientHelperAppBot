// import { cw, getAuthToken } from '../services';
import { pricesByItemCode, dropOfferHooks, getOfferHooks } from '../services/cw';
import { hookOffers } from '../services/ordering';

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

export async function trading(ctx) {

  const {
    match,
  } = ctx;
  const [, onOff] = match;
  const command = `/trading_${onOff}`;

  debug(command);

  try {
    switch (onOff) {
      case 'on':
        await hookOffers();
        ctx.replyHTML('Trading started');
        break;
      case 'off':
        dropOfferHooks();
        ctx.replyHTML('Trading stopped');
        break;
      case 'status': {
        const hooks = getOfferHooks();
        if (hooks.length) {
          ctx.replyHTML(hooks.join(', '));
        } else {
          ctx.replyHTML('Trading is stopped or no orders');
        }
        break;
      }
      default:
        ctx.replyHTML('Unknown trading parameter');
    }

  } catch (e) {
    ctx.replyError(command, e);
  }

}
