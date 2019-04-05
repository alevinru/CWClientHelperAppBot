import map from 'lodash/map';
import upperFirst from 'lodash/upperFirst';
import { distanceInWordsToNow } from 'date-fns';

import log from '../services/log';

import Shop from '../models/Shop';

const { debug } = log('mw:shops');


export async function shopInfo(ctx) {

  const { message: { text: command }, match } = ctx;
  const [, link] = match;

  debug('shopInfo:', link);

  try {

    const shop = await Shop.findOne({ link });

    if (!shop) {
      await ctx.replyWithHTML(`No shop with link <code>/ws_${link}</code>`);
      return;
    }

    await ctx.replyWithHTML(shopInfoText(shop));

  } catch (e) {
    ctx.replyError(command, e);
  }

}


export async function maintenanceShops(ctx) {

  // const { message } = ctx;
  const { match } = ctx;
  const [, link] = match;

  debug('maintenanceShops:', link);

  // try {
  //
  // } catch (e) {
  //   ctx.replyError('/maintenanceShops', e);
  // }

}


function shopInfoText(shop) {

  const { lastOpened } = shop;

  const openAgo = lastOpened ? distanceInWordsToNow(lastOpened) : '';

  const reply = [
    `${shop.kind} «${shop.name}» of ${shop.ownerCastle} <b>${shop.ownerName}</b>`,
    `💧 <b>${shop.mana}</b>${lastOpened ? ` opened <b>${openAgo}</b> ago` : ''}`,
  ];

  const { specialization, maintenanceEnabled } = shop;

  if (specialization) {
    reply.push(specializationInfo(specialization).join(' '));
  }

  if (maintenanceEnabled) {
    reply.push(`🔧 Offers maintenance for <code>${shop.maintenanceCost}</code>💰`);
  }

  return reply.join('\n');

}


function specializationInfo(specialization) {

  return map(specialization, (prc, type) => {

    const label = upperFirst(type);

    if (prc === 100) {
      return `‍‍🎓 ${label} guru`;
    }

    return `‍‍‍‍‍‍‍🎓${label}: ${prc}%`;

  });

}
