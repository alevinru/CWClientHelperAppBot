import { cw, getAuthToken } from '../services';
import { checkPrice } from './trades';
import { getProfile } from '../services/profile';
import { getToken } from '../services/auth';
import log from '../services/log';
import { checkViewAuth } from './profile';

const { debug } = log('mw:wtb');

export default async function (ctx) {

  const {
    match,
    from: { id: userId },
    session,
  } = ctx;
  const [, itemCode, quantity, price, matchUserId] = match;
  const wtb = `/wtb_${itemCode}_${quantity}_${price}`;

  debug(wtb);

  if (!session.profile) {
    ctx.reply('You are not authorized yet, do /auth prior to trading.');
    return;
  }

  try {

    const token = matchUserId ? await getToken(matchUserId) : getAuthToken(session);
    const profile = matchUserId ? await getProfile(matchUserId) : session.profile;
    const { userName } = profile;
    const { guild_tag: ownTag } = session.profile;

    await checkViewAuth(ctx, ownTag, profile.guild_tag, matchUserId || userId, userId);

    // const token = getAuthToken(session);
    const dealParams = {
      itemCode,
      quantity: parseInt(quantity, 0),
      price: parseInt(price, 0),
    };

    await checkPrice(itemCode, price);

    const deal = await cw.wantToBuy(parseInt(matchUserId || userId, 0), dealParams, token);

    const { itemName, quantity: dealQuantity } = deal;
    const tried = `✅ I have done ${wtb} for <b>${userName}</b>`;
    const got = `response of <b>${dealQuantity}</b> x <b>${itemName}</b>`;

    await ctx.replyHTML(`${tried} and got ${got}`);

  } catch (e) {
    const who = matchUserId ? 'The user' : 'You';
    if (!e.message && e.requiredOperation) {
      await ctx.replyWithHTML(`<b>${who}</b> have to do /authBuy first`);
      return;
    }
    debug(e);
    ctx.replyError(wtb, e);
  }

}
