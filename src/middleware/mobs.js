// import lo from 'lodash';
import { fromCWFilter } from '../config/filters';
import * as m from '../services/mobs';
import MobHunt, { secondsToFight } from '../models/MobHunt';

import log from '../services/log';

const { debug, error } = log('mobs');

const MOB_HUNT_UPDATE = parseInt(process.env.MOB_HUNT_UPDATE, 0) || 4000;

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

  debug('onMobForward:', forwardDate, messageId);

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

  if (secondsToFight(date) < 1) {
    await ctx.reply('🤷 ‍Mobs are expired', { ...SILENT, reply_to_message_id: messageId });
    return;
  }

  const reply = m.mobOfferView({ mobs, command, date });

  const replyMsg = await ctx.reply(reply.text, { ...SILENT, ...reply.keyboard });

  await MobHunt.updateOne({ command }, {
    $push: { replies: { messageId: replyMsg.message_id, chatId } },
  });

  const hunt = await MobHunt.findOne({ command });

  scheduleUpdate(chatId, replyMsg.message_id, hunt, ctx.telegram);

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

  await updateHuntMessage(chat.id, messageId, hunt._id, ctx.telegram);

}

async function updateHuntMessage(chatId, messageId, huntId, telegram) {

  const hunt = await MobHunt.findById(huntId);

  if (!hunt) {
    error('updateHuntMessage', 'no hunt id', huntId);
  }

  const { text, keyboard } = m.mobOfferView(hunt);
  const extra = { ...SILENT, ...keyboard };
  const notExpired = !hunt.isExpired();

  try {
    await telegram.editMessageText(chatId, messageId, null, text, extra);
  } catch (e) {
    error('updateHuntMessage', e.message);
  }

  // debug(hunt);

  if (notExpired) {
    scheduleUpdate(chatId, messageId, hunt, telegram);
  }

}

// TODO: refactor with redis
const SCHEDULED = new Map();

function isScheduled(chatId, messageId) {
  return SCHEDULED.get(`${chatId}-${messageId}`);
}

function scheduleUpdate(chatId, messageId, hunt, telegram) {

  const key = `${chatId}-${messageId}`;
  const scheduled = isScheduled(chatId, messageId);

  if (scheduled) {
    clearTimeout(scheduled);
  }

  const timeout = setTimeout(() => {
    SCHEDULED.delete(key);
    updateHuntMessage(chatId, messageId, hunt, telegram)
      .then(() => debug('scheduleUpdate', key, isScheduled(chatId, messageId)))
      .catch(e => error('scheduleUpdate', e));
  }, MOB_HUNT_UPDATE);

  SCHEDULED.set(key, timeout);

}
