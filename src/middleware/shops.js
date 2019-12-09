import map from 'lodash/map';
import find from 'lodash/find';
import groupBy from 'lodash/groupBy';
import filter from 'lodash/filter';
import take from 'lodash/take';
import upperFirst from 'lodash/upperFirst';
import orderBy from 'lodash/orderBy';
import minBy from 'lodash/minBy';
import flatten from 'lodash/flatten';

import { distanceInWordsToNow, addMinutes } from 'date-fns';

import lo from 'lodash';
import { searchRe } from '../services/util';
import log from '../services/log';
import { itemNameByCode, itemCodeByName } from '../services/cw';

import Shop from '../models/Shop';
import * as shopping from '../services/shopping';

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

    const lastDigest = await shopping.lastDigestOpened();

    await ctx.replyWithHTML(shopInfoText(shop, lastDigest));

  } catch (e) {
    ctx.replyError(command, e);
  }

}

export async function guruSpecialShops(ctx) {

  const [, spParam, levelParam] = ctx.match;

  const re = new RegExp(`^${lo.escapeRegExp(spParam)}`);

  const gurus = await shopping.gurus(parseInt(levelParam, 0));

  const title = levelParam ? `${levelParam}⃣ level` : 'Top';

  const matching = find(gurus, ({ specialization }) => re.test(specialization));

  if (!matching) {
    await ctx.replyWithHTML(`No gurus matching specialization <code>${spParam}</code>`);
    return;
  }

  const reply = [
    `<b>${title} quality</b> gurus`,
    '',
    specializationGuruList(matching),
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function guruShops(ctx) {

  const [, levelParm] = ctx.match;

  const gurus = await shopping.gurus(parseInt(levelParm, 0));

  const title = levelParm ? `${levelParm}⃣ level` : 'Top';

  const reply = [
    `<b>${title} quality</b> /guru${levelParm ? `_${levelParm}` : ''}`,
    '',
    map(orderBy(gurus, 'specialization'), specializationGuruList).join('\n\n'),
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}


export async function maintenanceShops(ctx) {

  // // const { message } = ctx;
  const { match } = ctx;
  const [, castle] = match || [];

  debug('maintenanceShops:', castle || 'any');

  try {

    const lastOpened = await shopping.lastDigestOpened();

    const ownerCastle = castleByLetter(castle);

    const openShop = {
      lastOpened,
      maintenanceEnabled: true,
      mana: { $gt: 60 },
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

    const sorted = orderBy(shops, shop => mntPrice(shop, ownerCastle));

    const reply = [
      `${title} <b>${distanceInWordsToNow(lastOpened)}</b> ago:\n`,
      ...sorted.map(shop => shopAsMaintenanceListItem(shop, ownerCastle)),
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


function specializationGuruList({ specialization, level, shops }) {

  return [
    `<b>${shopping.specializationTitle(specialization)}</b> level ${level}⃣`,
    '',
    ...shops.map(guruAsListItem),
  ].join('\n');

}

function guruAsListItem(shop) {

  const { ownerCastle, isOpen } = shop;

  return [
    isOpen ? '✅' : '⏸',
    `/ws_${shop.link}`,
    ownerCastle,
    shopOwnerAsLink(shop),
  ].join(' ');

}

export async function shopsByItem(ctx) {

  const { match } = ctx;
  const [, search] = match || [];

  const lastOpened = await shopping.lastDigestOpened();

  const itemName = itemNameByCode(search);

  debug('shopsByItem', `"${search}"`, itemName);

  const $regex = itemName ? new RegExp(`^${itemName}$`) : searchRe(search);

  const shops = await Shop.find({
    lastOpened,
    mana: { $gt: 0 },
    'offers.item': { $regex },
  });
  // .sort({ mana: -1 })
  // .limit(12);

  if (!shops.length) {
    await ctx.replyWithHTML(`No open shops matching <b>${search}</b>`);
    return;
  }

  const matchingItems = orderBy(shopsItems(shops, $regex), ['mana', 'name']);

  if (matchingItems.length > 12) {
    await ctx.replyWithHTML(`<b>${search}</b> matches too many items`);
    return;
  }

  if (matchingItems.length > 1) {

    const replyMultipleItems = [
      `There are more than one item's matching <b>${search}</b>:`,
      '',
      ...matchingItems.map(({ item, price, mana }) => {
        const code = itemCodeByName(item);
        return `${code ? `/wf_${code}` : '▪︎'} ${item} 💰${price} 💧${mana}`;
      }),
      '',
      'Please specify',
    ];

    await ctx.replyWithHTML(replyMultipleItems.join('\n'));

    return;

  }

  const { item } = matchingItems[0];
  const itemCode = itemCodeByName(item);
  const shoppedItems = shopsItem(shops, item);

  const sorter = [['hasMana', 'price', 'mana'], ['desc', 'asc', 'desc']];

  const itemShops = orderBy(shoppedItems, ...sorter);

  const reply = [
    `Best offers for <b>${item}</b> at <b>${distanceInWordsToNow(lastOpened)}</b> ago:`,
    '',
    ...take(itemShops, 12).map(shopAsListItem),
  ];

  if (itemCode && !itemName) {
    reply.push(`\n/wf_${itemCode}`);
  }

  await ctx.replyWithHTML(reply.join('\n'));

}

function shopsItem(shops, itemName) {

  const res = map(shops, shop => {

    const offer = find(shop.offers, ({ item }) => {
      return itemName === item;
    });

    const hasMana = offer && offer.mana <= shop.mana + 30;

    return offer && {
      ...shop.toObject(),
      price: offer.price,
      hasMana: hasMana ? 0 : (shop.mana - offer.mana),
    };

  });

  return filter(res);

}

function shopsItems(shops, $regex) {

  const allItems = map(shops, ({ offers }) => {
    const matchingOffers = filter(offers, ({ item }) => $regex.test(item));
    return matchingOffers;
  });

  return map(groupBy(flatten(allItems), 'item'), (offers, item) => {
    const { price, mana } = minBy(offers, 'price');
    return {
      item,
      price,
      mana,
    };
  });

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

function shopAsMaintenanceListItem(shop, castle) {

  const { ownerCastle, mana } = shop;
  const link = `/wsr_${shop.link}`;
  const cost = mntPrice(shop, castle);

  return [
    `💰${cost}`,
    `💧${mana}`,
    link,
    `${ownerCastle}`,
    shopOwnerAsLink(shop, '/wsr_'),
  ].join(' ');

}

function mntPrice(shop, castle) {
  const { ownerCastle, maintenanceCost, castleDiscount } = shop;
  return (castle === ownerCastle && castleDiscount)
    ? Math.ceil(maintenanceCost * (100.0 - castleDiscount) / 100.0) : maintenanceCost;
}

function shopOwnerAsLink({ link, ownerName }, prefix = '/ws_') {
  return `<a href="http://t.me/share/url?url=${prefix}${link}">${ownerName}</a>`;
}

function shopAsListItem(shop) {

  const { ownerCastle, qualityCraftLevel } = shop;
  const { mana, price } = shop;

  const link = `/ws_${shop.link}`;

  const qc = qualityCraftLevel && isGuru(shop) && `${qualityCraftLevel}⃣`;

  return filter([
    `💰${price}`,
    `💧${mana}`,
    qc,
    link,
    ownerCastle,
    shopOwnerAsLink(shop),
  ]).join(' ');

}

function shopInfoText(shop, lastDigest) {

  const { lastOpened, qualityCraftLevel, castleDiscount } = shop;

  const openAgo = lastOpened ? distanceInWordsToNow(lastOpened) : '';
  const closedAgo = lastOpened ? distanceInWordsToNow(addMinutes(lastOpened, 5)) : 'sometime';

  const isOpen = lastDigest <= lastOpened;

  const status = isOpen ? `open about <b>${openAgo}</b>` : `closed <b>${closedAgo}</b>`;

  const qc = qualityCraftLevel && `${qualityCraftLevel}⃣`;

  const reply = [
    `${shop.kind} «${shop.name}» of ${shop.ownerCastle} ${shopOwnerAsLink(shop)}`,
    `💧 <b>${shop.mana}</b> was ${status} ago`,
  ];

  const { specialization, maintenanceEnabled, offers } = shop;

  if (specialization) {
    const info = specializationInfo(specialization).join('\n');
    const guruSpecs = filter([info, /guru/.test(info) && qc]);
    if (guruSpecs.length) {
      reply.push(guruSpecs.join(' '));
    }
  }

  if (maintenanceEnabled) {
    reply.push(`🔧 Maintenance for <code>${shop.maintenanceCost}</code>💰`);
  }

  if (castleDiscount) {
    reply.push(`🏰 ${castleDiscount}%`);
  }

  if (offers) {
    reply.push('', ...offersInfo(offers));
  }

  return reply.join('\n');

}

function isGuru(shop) {
  return specializationInfo(shop.specialization)
    .filter(text => text.match(/guru/))
    .length > 0;
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
