import * as cw from '../services/cw';

const debug = require('debug')('laa:cwb:wtb');

export default async function (ctx) {

  const {
    match,
    from: { id: userId },
    session: { profile },
  } = ctx;
  const [, itemCode, quantity, price] = match;
  const command = `/order_${itemCode}_${quantity}_${price}`;

  debug(command);

  if (!profile) {
    ctx.reply('You are not authorized yet, do /auth prior to trading.');
    return;
  }

  const { userName } = profile;

  try {

    // const token = getAuthToken(session);
    // const dealParams = { itemCode, quantity, price };

    await cw.addOrder(userId, itemCode, quantity, price);

    const res = [
      `✅ I have added an order for <b>${userName}</b>:\n`,
      `to buy <b>${quantity}</b> of <b>${cw.itemNameByCode(itemCode)}</b>`,
      `by max price of <b>${price}</b>💰\n`,
      `and the total sum is <b>${price * quantity}</b>💰`,
    ];

    await ctx.replyHTML(res.join(' '));

  } catch (e) {
    ctx.replyError(command, e);
  }

}


export async function orders(ctx) {

  const {
    match,
  } = ctx;
  const [, itemCode] = match;
  const command = `/orders_${itemCode}`;

  debug(command);

  try {
    const res = await cw.getOrdersByItemCode(itemCode);
    ctx.reply(res);
  } catch (e) {
    ctx.replyError(command, e);
  }

}
