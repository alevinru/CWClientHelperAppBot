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

bot.command('wtb', async ({ reply, from: { id: userId } }) => {

  debug('wtb', userId);

  try {
    const { itemName, quantity } = await cw.wantToBy(userId, { itemCode: '07', quantity: 1, price: 1 });
    reply(`WTB success ${itemName} x ${quantity}`);
    debug('wtb', userId, itemName, quantity);
  } catch (err) {
    reply('Something went wrong, auth failed');
    debug('onAuth', err);
  }

});

bot.on('message', async ({ message, from: { id: userId }, reply }, next) => {

  await next();

  debug('message from:', userId, message);

  const { forward_from, entities, text } = message;
  const codeEntity = find(entities, { type: 'code' });

  if (forward_from && codeEntity) {

    const { id: fromId } = forward_from;
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

  }

});

bot.catch(err => {
  debug('catch:', err);
});

bot.startPolling();

