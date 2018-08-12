import { cw } from '../services/cw';

const debug = require('debug')('laa:cwb:wtb');

export default async function ({ match, from: { id: userId }, reply }) {

  const [, itemCode, quantity, price] = match;
  const wtb = `/wtb_${itemCode}_${quantity}_${price}`;

  debug(wtb, match);

  try {
    const deal = await cw.wantToBy(userId, { itemCode, quantity, price });
    const { itemName, quantity: dealQuantity } = deal;
    reply(`Successfully did ${wtb} and got response of ${dealQuantity} of ${itemName}`);
  } catch (e) {
    reply(`Tried ${wtb} but got "${e}" exception`);
  }

}
