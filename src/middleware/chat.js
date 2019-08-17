import log from '../services/log';
import Chat from '../models/Chat';

const { debug } = log('chat');

const SETTING_NAMES = ['notifyBattle'];

export async function setting(ctx) {

  const { chat, match: [, name, onOff] } = ctx;

  if (await ifInvalidSetting(ctx, name)) {
    return;
  }

  const value = /^(on|true|1)$/.test(onOff);

  await Chat.saveValue(chat.id, name, value);

  await ctx.replyWithHTML(settingView(chat.id, name, 'from now on is', value));

}


export async function viewSetting(ctx) {

  const { chat, match } = ctx;

  const [, name] = match;

  if (await ifInvalidSetting(ctx, name)) {
    return;
  }

  const value = await Chat.findValue(chat.id, name);

  await ctx.replyWithHTML(settingView(chat.id, name, 'is', value));

}

function settingView(chatId, name, action, value) {
  debug('settingView', chatId, name, action, value);
  return [
    'Setting',
    `<b>${name}</b> ${action} <b>${value}</b>`,
    'for chat id',
    `<code>${chatId}</code>`,
  ].join(' ');
}

async function ifInvalidSetting(ctx, name) {
  if (SETTING_NAMES.includes(name)) {
    return false;
  }
  await ctx.replyWithHTML(`⚠ Invalid setting <b>${name}</b>`);
  return true;
}
