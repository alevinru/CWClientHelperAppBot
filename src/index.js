import Telegraf from 'telegraf';
import find from 'lodash/find';

import CWExchange from 'cw-rest-api/src/exchange/CWExchange';

const debug = require('debug')('laa:cwb:index');

const { BOT_TOKEN } = process.env;

const CW_BOT_ID = parseInt(process.env.CW_BOT_ID, 0);

debug('Started bot id:', BOT_TOKEN.match(/^[^:]*/)[0]);

const bot = new Telegraf(BOT_TOKEN);

const cw = new CWExchange();

cw.connect();

bot.command('auth', async ({ reply, from: { id: userId } }) => {

  debug('onAuth', userId);

  try {
    await cw.sendAuth(userId);
    reply(`Auth sent to ${userId} forward this message back here to complete authorization`);
  } catch (err) {
    reply('Something went wrong, auth failed');
    debug('onAuth', err);
  }

});

bot.on('message', async ({ message: { text }, from: { id: userId }, reply }, next) => {

  await next();

  const wtb = text.match(/^\/wtb[ _](.+)[ _](.+)[ _](.+)$/);

  if (!wtb) {
    return;
  }

  const [, itemCode, quantity, price] = wtb;

  debug('wtb', userId, itemCode, quantity, price);

  try {
    const deal = await cw.wantToBy(userId, { itemCode, quantity, price });
    const { itemName, quantity: dealQuantity } = deal;
    reply(`Success /wtb_${itemCode}_${quantity}_${price} got ${dealQuantity} of ${itemName}`);
  } catch (e) {
    reply(e);
  }

});

bot.on('message', async ({ message, from: { id: userId }, reply }, next) => {

  await next();

  debug('message from:', userId, message.text);

  const { forward_from: from, entities, text } = message;
  const codeEntity = find(entities, { type: 'code' });

  if (!from || !codeEntity) {
    return;
  }

  const { id: fromId } = from;
  const { offset, length } = codeEntity;
  const code = text.substr(offset, length);

  if (fromId === CW_BOT_ID) {
    try {
      const token = await cw.sendGrantToken(userId, code);
      reply('Auth success!');
      debug('message token:', token);
    } catch (e) {
      reply(e);
    }
  } else {
    reply(`Forward from bot id ${fromId} ignored`);
  }

});

bot.catch(err => {
  debug('catch:', err);
});

bot.startPolling();
