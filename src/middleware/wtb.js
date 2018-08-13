import { cw } from '../services/cw';
import { getAuthToken } from '../services/auth';

const debug = require('debug')('laa:cwb:wtb');

export default async function (ctx) {

  const {
    match, from: { id: userId }, reply, session,
  } = ctx;
  const [, itemCode, quantity, price] = match;
  const wtb = `/wtb_${itemCode}_${quantity}_${price}`;

  debug(wtb, match);

  try {
    const token = getAuthToken(session);
    const dealParams = { itemCode, quantity, price };
    const deal = await cw.wantToBy(parseInt(userId, 0), dealParams, token);
    const { itemName, quantity: dealQuantity } = deal;
    reply(`Successfully did ${wtb} and got response of ${dealQuantity} of ${itemName}`);
  } catch (e) {
    reply(`Tried ${wtb} but got "${e}" exception`);
  }

}
