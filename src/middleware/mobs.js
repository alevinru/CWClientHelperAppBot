// import lo from 'lodash';
import { fromCWFilter } from '../config/filters';
import * as m from '../services/mobs';
import MobHunt from '../models/MobHunt';

import log from '../services/log';

const { debug } = log('mobs');

const SILENT = { parse_mode: 'HTML', disable_notification: true, disable_web_page_preview: true };

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

  await MobHunt.updateOne({ command }, {
    $push: { replies: { messageId: replyMsg.message_id, chatId } },
  });

}

export async function onHelpingClick(ctx) {

  const { update, chat } = ctx;
  const { message, from } = update.callback_query;

  debug('onHelpingClick', update);

  if (message.text.match('is helping')) {
    await ctx.answerCbQuery('Already got help');
    return;
  }

  const { message_id: messageId } = message;

  const hunt = await MobHunt.findOne({ 'replies.messageId': messageId });

  if (!hunt) {
    const oldWay = `${message.text}\n\n✅ @${from.username} is helping`;
    await ctx.editMessageText(oldWay, SILENT);
    return;
  }

  hunt.helper = {
    userName: from.username,
    userId: from.id,
    firstName: from.first_name,
    lastName: from.last_name,
  };

  await hunt.save();

  await updateHuntMessage(chat.id, messageId, hunt, ctx.telegram);

}

async function updateHuntMessage(chatId, messageId, hunt, telegram) {

  const { text, keyboard } = m.mobOfferView(hunt);

  const extra = { ...SILENT, ...keyboard };

  await telegram.editMessageText(chatId, messageId, null, text, extra);

}
