// import map from 'lodash/map';
// import upperFirst from 'lodash/upperFirst';
// import orderBy from 'lodash/orderBy';
import { distanceInWordsToNow, format } from 'date-fns';

import log from '../services/log';

import Auction from '../models/Auction';

const { debug } = log('mw:au');

export async function showItem(ctx) { // eslint-disable-line

  const { message: { text: command }, match } = ctx;
  const [, lotId] = match;

  debug('showItem:', command);

  const item = await Auction.findOne({ lotId });

  if (!item) {
    await ctx.replyWithHTML(`Lot <code>${lotId}</code> not found`);
    return;
  }

  await ctx.replyWithHTML(itemView(item));

}


function itemView(item) {

  const { lotId, status, itemName } = item;
  const { sellerName, sellerCastle } = item;
  const { buyerName, buyerCastle } = item;
  const { finishedAt, endAt } = item;

  const reply = [
    `<b>${itemName}</b>`,
    `/l_${lotId} by ${sellerCastle}${sellerName}`,
    `Status: ${status}`,
    `Price: ${item.price}`,
  ];

  if (finishedAt) {
    reply.push(`Finished at: ${format(finishedAt, 'YYYY-MM-DD HH:mm Z')}`);
    if (buyerName) {
      reply.push(`Buyer: ${buyerCastle}${buyerName}`);
    }
  } else {
    reply.push(`Should end in: ${distanceInWordsToNow(endAt)}`);
    reply.push(`Buyer castle: ${buyerCastle}`);
  }

  return reply.join('\n');

}
