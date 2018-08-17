import { cw, getAuthToken } from '../services';

const debug = require('debug')('laa:cwb:wtb');

export default async function (ctx) {

  const {
    match,
    from: { id: userId },
    session,
    session: { profile: { userName } },
  } = ctx;
  const [, itemCode, quantity, price] = match;
  const wtb = `/wtb_${itemCode}_${quantity}_${price}`;

  debug(wtb);

  try {
    const token = getAuthToken(session);
    const dealParams = { itemCode, quantity, price };
    const deal = await cw.wantToBy(parseInt(userId, 0), dealParams, token);
    const { itemName, quantity: dealQuantity } = deal;
    const tried = `I have done ${wtb} for <b>${userName}</b>`;
    const got = `response of <b>${dealQuantity}</b> x <b>${itemName}</b>`;
    ctx.replyHTML(`${tried} and got ${got}`);
  } catch (e) {
    ctx.replyError(wtb, e);
  }

}
