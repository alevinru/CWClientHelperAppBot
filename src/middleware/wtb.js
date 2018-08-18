import { cw, getAuthToken } from '../services';
import { checkPrice } from './trades';

const debug = require('debug')('laa:cwb:wtb');

export default async function (ctx) {

  const {
    match,
    from: { id: userId },
    session,
    session: { profile },
  } = ctx;
  const [, itemCode, quantity, price] = match;
  const wtb = `/wtb_${itemCode}_${quantity}_${price}`;

  debug(wtb);

  if (!profile) {
    ctx.reply('You are not authorized yet, do /auth prior to trading.');
    return;
  }

  const { userName } = profile;

  try {

    const token = getAuthToken(session);
    const dealParams = { itemCode, quantity, price };

    await checkPrice(itemCode, price);

    const deal = await cw.wantToBuy(parseInt(userId, 0), dealParams, token);

    const { itemName, quantity: dealQuantity } = deal;
    const tried = `✅ I have done ${wtb} for <b>${userName}</b>`;
    const got = `response of <b>${dealQuantity}</b> x <b>${itemName}</b>`;

    await ctx.replyHTML(`${tried} and got ${got}`);

  } catch (e) {
    ctx.replyError(wtb, e);
  }

}
