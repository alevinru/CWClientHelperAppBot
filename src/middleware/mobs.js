// import lo from 'lodash';
import { fromCWFilter } from '../config/filters';
import * as m from '../services/mobs';
import MobHunt from '../models/MobHunt';

import log from '../services/log';

const { debug } = log('mobs');

const SILENT = { parse_mode: 'HTML', disable_notification: true };

export function metMobFilter(ctx) {

  const { state, message } = ctx;
  const { text } = message;

  if (!text || !fromCWFilter(ctx)) {
    return false;
  }

  const mobs = m.mobsFromText(text);

  if (!mobs) {
    return false;
  }

  state.mobs = mobs;

  return true;

}

export async function onMobForward(ctx) {

  const { id: chatId } = ctx.chat;
  const { mobs: { mobs, command } } = ctx.state;
  const { forward_date: forwardDate, message_id: messageId } = ctx.message;

  if (!await m.chatMobHunting(chatId)) {
    return;
  }

  const date = new Date(forwardDate * 1000);

  const secondsToFight = m.secondsToFight(date);

  debug('onMobForward:', forwardDate, secondsToFight, messageId);

  await MobHunt.updateOne(
    { command },
    {
      $set: {
        date,
        messageId,
        mobs,
      },
    },
    { upsert: true },
  );

  if (secondsToFight < 1) {
    await ctx.reply('🤷 ‍Mobs are expired', { ...SILENT, reply_to_message_id: messageId });
    return;
  }

  const reply = m.mobOfferView({ mobs, command, date });

  const replyMsg = await ctx.reply(reply.text, { ...SILENT, ...reply.keyboard });

  await MobHunt.updateOne({ command }, { reply: { messageId: replyMsg.message_id, chatId } });

}

export async function onHelpingClick(ctx) {

  const { update } = ctx;
  const { message, from } = update.callback_query;

  debug('onHelpingClick', update);

  debug(message.entities);

  if (message.text.match('is helping')) {
    await ctx.answerCbQuery('Already got help');
    return;
  }

  const modified = `${message.text}\n\n✅ @${from.username} is helping`;

  const { reply_markup: { inline_keyboard: [kb] } } = message;
  const markup = { reply_markup: { inline_keyboard: [[kb[0]]] } };

  await ctx.editMessageText(modified, { ...SILENT, ...markup });

}
