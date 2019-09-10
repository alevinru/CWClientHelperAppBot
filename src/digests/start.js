import log from '../services/log';
import Chat from '../models/Chat';

import { BOT_ID } from '../services/bot';

const { debug } = log('digests:start');

export async function start(ctx) {

  const { from: { id: userId } } = ctx;
  debug(userId);

  const reply = [
    'Welcome to <b>ChatWars</b> digests bot!',
    '',
    'Add this bot to any chat to start receiving battle micro-reports',
    '',
    'Try /ba to show recent battle',
  ].join('\n');

  await ctx.replyWithHTML(reply);

}

export async function onNewMember(ctx) {
  await setSettingsFromMessage(ctx, 'new_chat_member', true);
}

export async function onLeftMember(ctx) {
  await setSettingsFromMessage(ctx, 'left_chat_member', false);
}

export async function onChatCreated(ctx) {
  await setSettingsFromUpdate(ctx, 'group_chat_created', true);
}

export async function onChatMigratedTo(ctx) {
  await setSettingsFromUpdate(ctx, 'migrate_to_chat_id', false);
}

export async function onChatMigratedFrom(ctx) {
  await setSettingsFromUpdate(ctx, 'migrate_from_chat_id', true);
}

async function setSettingsFromMessage(ctx, type, value) {

  const { message: { [type]: member }, chat: { id: chatId } } = ctx;

  if (BOT_ID === member.id) {
    await Chat.saveValue(chatId, 'notifyBattle', value);
    debug('setSettingsFromMessage', chatId, type, value);
  }

}

async function setSettingsFromUpdate(ctx, type, value) {

  const { chat: { id: chatId } } = ctx.update.message;

  await Chat.saveValue(chatId, 'notifyBattle', value);
  debug('setSettingsFromUpdate', chatId, type, value);

}
