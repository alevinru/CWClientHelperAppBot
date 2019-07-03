import map from 'lodash/map';
import filter from 'lodash/filter';
import upperFirst from 'lodash/upperFirst';
import orderBy from 'lodash/orderBy';
import { distanceInWordsToNow, addMinutes } from 'date-fns';

import { searchRe } from '../services/util';
import log from '../services/log';

import Shop from '../models/Shop';

const { debug, error } = log('mw:shops');


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

    const lastDigest = await lastDigestOpened();

    await ctx.replyWithHTML(shopInfoText(shop, lastDigest));

  } catch (e) {
    ctx.replyError(command, e);
  }

}


export async function maintenanceShops(ctx) {

  // // const { message } = ctx;
  const { match } = ctx;
  const [, castle] = match || [];

  debug('maintenanceShops:', castle || 'any');

  try {

    const lastOpened = await lastDigestOpened();

    const ownerCastle = castleByLetter(castle);

    const openShop = {
      lastOpened,
      maintenanceEnabled: true,
    };

    if (ownerCastle) {
      Object.assign(openShop, { ownerCastle });
    } else if (castle) {
      await ctx.replyWithHTML(castleHelp(!castle.match(/help/i) && castle));
      return;
    }

    const shops = await Shop.find(openShop)
      .sort({
        maintenanceCost: 1,
        mana: -1,
      })
      .limit(12);

    const title = `Best ${ownerCastle || ''}${ownerCastle ? ' ' : ''}maintenance`;

    const reply = [
      `${title} <b>${distanceInWordsToNow(lastOpened)}</b> ago:\n`,
      ...shops.map(shopAsMaintenanceListItem),
    ];

    if (!shops.length) {
      reply.push('No open shops found');
    }

    await ctx.replyWithHTML(reply.join('\n'));

  } catch (e) {
    error('maintenanceShops', e);
    ctx.replyError('/maintenanceShops', e);
  }

}


export async function shopsByItem(ctx) {

  const { match } = ctx;
  const [, search] = match || [];

  const lastOpened = await lastDigestOpened();

  debug('shopsByItem', `"${search}"`);

  const $regex = searchRe(search);

  const shops = await Shop.find({
    lastOpened,
    'offers.item': { $regex },
  })
    .sort({ mana: -1 })
    .limit(12);

  if (!shops.length) {
    await ctx.replyWithHTML(`No open shops matching <b>${search}</b>`);
    return;
  }

  const reply = shops.map(shop => shopAsListItem(shop, $regex));

  await ctx.replyWithHTML(reply.join('\n\n'));

}

const CASTLES = JSON.parse(process.env.CASTLES);

function castleHelp(castle) {
  return [
    castle ? `Unknown castle code <code>${castle}</code>` : 'Shows cheapest open maintenance shops:',
    '',
    map(CASTLES, (icon, code) => `${icon} /mnt_${code}`).join('\n'),
    '\nor /mnt for any castle',
  ].join('\n');
}

function castleByLetter(letter) {

  return CASTLES[letter];

}

function shopAsMaintenanceListItem(shop) {

  const { ownerCastle, ownerName, link } = shop;
  const { mana, maintenanceCost } = shop;

  return `${ownerCastle} ${maintenanceCost}💰 ${mana}💧 /wsr_${link} <b>${ownerName}</b>`;

}

function shopAsListItem(shop, $regex) {

  const { ownerCastle, ownerName, link } = shop;
  const { mana, offers } = shop;

  const matchingOffers = filter(offers, ({ item }) => $regex.test(item));

  const offersList = matchingOffers.map(({ item, price }) => {
    return `▪︎ ${item}: ${price}💰`;
  });

  return [
    `${ownerCastle} ${mana}💧 /wsr_${link} <b>${ownerName}</b>`,
    ...offersList,
  ].join('\n');

}

function shopInfoText(shop, lastDigest) {

  const { lastOpened } = shop;

  const openAgo = lastOpened ? distanceInWordsToNow(lastOpened) : '';
  const closedAgo = lastOpened ? distanceInWordsToNow(addMinutes(lastOpened, 5)) : 'sometime';

  const isOpen = lastDigest <= lastOpened;

  const status = isOpen ? `open about <b>${openAgo}</b>` : `closed <b>${closedAgo}</b>`;

  const reply = [
    `${shop.kind} «${shop.name}» of ${shop.ownerCastle} <b>${shop.ownerName}</b>`,
    `💧 <b>${shop.mana}</b> was ${status} ago`,
  ];

  const { specialization, maintenanceEnabled, offers } = shop;

  if (specialization) {
    reply.push(specializationInfo(specialization).join(' '));
  }

  if (maintenanceEnabled) {
    reply.push(`🔧 Maintenance for <code>${shop.maintenanceCost}</code>💰`);
  }

  if (offers) {
    reply.push('', ...offersInfo(offers));
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

function offersInfo(offers) {

  return map(orderBy(offers, 'item'), offer => {

    const { item, mana, price } = offer;

    return `‍‍‍‍‍‍‍▪︎ ${item}: <code>${price}</code>💰 ${mana}💧`;

  });

}

async function lastDigestOpened() {
  const last = await Shop.findOne().sort({ lastOpened: -1 });
  return last ? last.lastOpened : null;
}
