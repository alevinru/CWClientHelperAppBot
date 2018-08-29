import { cw, getAuthToken } from '../services';
import { getToken } from '../services/auth';
import log from '../services/log';

const { debug } = log('mw:stock');

export default async function (ctx) {

  const { session, from: { id: sessionUserId }, message } = ctx;
  const match = message.text.match(/\/stock[ _]?(\d*)$/);
  const [, matchUserId] = match;
  const userId = matchUserId || sessionUserId;
  debug(userId, match);

  try {
    const token = matchUserId ? await getToken(matchUserId) : getAuthToken(session);

    // const token = getAuthToken(session);
    const { stock } = await cw.requestStock(parseInt(userId, 0), token);
    ctx.replyJson(stock);
    debug(`GET /stock/${userId}`, Object.keys(stock).length, 'items');
  } catch (e) {
    ctx.replyError('/stock', e);
  }

}
