import { distanceInWordsToNow, format } from 'date-fns';

export function auctionItemView(item) {

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
    if (buyerCastle) {
      reply.push(`Buyer castle: ${buyerCastle}`);
    }
  }

  return reply.join('\n');

}
