import * as a from '../services/auction';
import Auction from '../models/Auction';
import log from '../services/log';

const { debug } = log('mw:au');

export async function showItem(ctx) { // eslint-disable-line

  const { message: { text: command }, match } = ctx;
  const { from, chat } = ctx;
  const [, lotId] = match;

  debug('showItem:', command);

  const item = await Auction.findOne({ lotId });

  if (!item) {
    if (chat.id === from.id) {
      await ctx.replyWithHTML(`Lot <code>${lotId}</code> not found`);
    }
    return;
  }

  await ctx.replyWithHTML(a.auctionItemView(item));

}
