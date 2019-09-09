import log from '../services/log';
import Chat from '../models/Chat';

import { BOT_ID } from '../services/bot';

const { debug } = log('digests:start');

export async function start(ctx) {

  const { from: { id: userId } } = ctx;
  debug(userId);

  const reply = [
    'Welcome to ChatWars digests bot!',
    'Add this bot to any chat to start receiving battle mini-reports.',
    'Use /ba to show recent battle.',
  ].join('\n');

  await ctx.replyWithHTML(reply);

}

export async function onNewMember(ctx) {
  await setSettings(ctx, 'new_chat_member');
}

export async function onLeftMember(ctx) {
  await setSettings(ctx, 'left_chat_member');
}

async function setSettings(ctx, type) {

  const { message: { [type]: member }, chat: { id: chatId } } = ctx;

  if (BOT_ID === member.id) {
    await Chat.saveValue(chatId, 'notifyBattle', type === 'new_chat_member');
    debug('setSettings', chatId, type);
  }

}
