import lo from 'lodash';
import { fromCWFilter } from '../config/filters';
import * as m from '../services/mobs';
import MobHunt, { secondsToFight } from '../models/MobHunt';

import log from '../services/log';
import Chat, * as c from '../models/Chat';

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
  const {
    mobs: {
      mobs, command, isAmbush, isCheaters,
    },
  } = ctx.state;
  const { forward_date: forwardDate, message_id: messageId } = ctx.message;

  if (!await m.chatMobHunting(chatId)) {
    return;
  }

  const date = new Date(forwardDate * 1000);

  debug('onMobForward:', forwardDate, messageId);

  const reporter = userData(ctx.from);
  const helpers = isAmbush ? [{ ...reporter }] : [];
  const $setOnInsert = { reporter, helpers };

  const $set = {
    date,
    messageId,
    mobs,
    isAmbush,
    isCheaters,
  };

  await MobHunt.updateOne(
    { command },
    { $set, $setOnInsert },
    { upsert: true },
  );

  if (secondsToFight(date, isAmbush) < 1) {
    await ctx.reply('🤷 ‍Mobs are expired', { ...SILENT, reply_to_message_id: messageId });
    return;
  }

  const reply = m.mobOfferView({ ...$set, command });
  const replyMsg = await ctx.reply(reply.text, { ...SILENT, ...reply.keyboard });
  const { message_id: replyMessageId } = replyMsg;

  await MobHunt.updateOne({ command }, {
    $push: { replies: { messageId: replyMsg.message_id, chatId } },
  });

  const hunt = await MobHunt.findOne({ command });

  if (ctx.from.id !== chatId && await Chat.findValue(chatId, c.CHAT_SETTING_PIN_MOBS)) {
    await ctx.pinChatMessage(replyMessageId)
      .catch(onPinError)
      .catch(error);
  }

  scheduleUpdate(chatId, replyMessageId, hunt, ctx.telegram);

  async function onPinError(e) {

    error('onPinError', e);

    await Chat.saveValue(chatId, c.CHAT_SETTING_PIN_MOBS, false);
    debug('pinChatMessage', 'pinChatMessage off for chatId:', chatId);

    const noRights = [
      '🤷‍ ️I have no permission to pin in ths chat,',
      `so i turned off the <b>${c.CHAT_SETTING_PIN_MOBS}</b> setting.`,
      `If you give me the permission issue /chat_set_${c.CHAT_SETTING_PIN_MOBS}_on`,
    ].join(' ');

    return ctx.replyWithHTML(noRights);

  }

}

export async function onHelpingClick(ctx) {

  const { update, chat } = ctx;
  const { message, from } = update.callback_query;

  // debug('onHelpingClick', update);

  const isMultiHelping = message.text.match(/Ambush|Cheaters/);

  if (!isMultiHelping && message.text.match('is helping')) {
    ctx.answerCbQuery('Already got help')
      .catch(error);
    return;
  }

  const { message_id: messageId } = message;

  const hunt = await MobHunt.findOne({ replies: { $elemMatch: { messageId, chatId: chat.id } } });

  if (!hunt) {
    const oldWay = `${message.text}\n\n✅ @${from.username} is helping`;
    await ctx.editMessageText(oldWay, SILENT);
    return;
  }

  const { helpers, command } = hunt;

  if (isMultiHelping) {

    if (lo.find(helpers, { userId: from.id })) {
      return;
    }

    await MobHunt.updateOne({ command }, {
      $push: { helpers: userData(from) },
    });

  } else {
    hunt.helper = userData(from);
    await hunt.save();
  }

  ctx.answerCbQuery('Thanks for your helping!')
    .catch(error);

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
    // .then(() => debug('scheduleUpdate', key, isScheduled(chatId, messageId)))
      .catch(e => error('scheduleUpdate', e));
  }, MOB_HUNT_UPDATE);

  SCHEDULED.set(key, timeout);

}

function userData(from) {
  return {
    userName: from.username,
    userId: from.id,
    firstName: from.first_name,
    lastName: from.last_name,
  };
}
