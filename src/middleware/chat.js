import lo from 'lodash';
import log from '../services/log';
import Chat, * as c from '../models/Chat';

const { debug } = log('chat');

const SETTING_NAMES = [
  c.CHAT_SETTING_NOTIFY_BATTLE,
  c.CHAT_SETTING_MOB_HUNTING,
  c.CHAT_SETTING_PIN_MOBS,
];

export async function setting(ctx) {

  const { chat, match: [, name, onOff] } = ctx;

  if (await ifNotPermitted(ctx)) {
    return;
  }

  if (await ifInvalidSetting(ctx, name)) {
    return;
  }

  const value = /^(on|true|1)$/.test(onOff);
  await Chat.saveValue(chat.id, name, value);
  await ctx.replyWithHTML(settingView(chat.id, name, 'from now on is', value));

}


export async function viewSettings(ctx) {

  const { chat } = ctx;

  if (await ifNotPermitted(ctx)) {
    return;
  }

  debug('viewSettings', chat);

  const settings = await Chat.findSettings(chat.id);

  const title = `for the <b>${chat.title}</b> chat`;

  if (!settings.length) {
    await ctx.replyWithHTML(`I have no settings ${title}`);
    return;
  }

  const values = lo.map(settings, ({ name, value }) => {
    return `<code>${name}</code>: <b>${value ? 'on' : 'off'}</b>`;
  });

  const reply = [
    `My settings ${title}`,
    '',
    ...values,
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function viewSetting(ctx) {

  const { chat, match: [, name] } = ctx;

  if (await ifNotPermitted(ctx)) {
    return;
  }

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

async function ifNotPermitted(ctx) {

  const { chat, from } = ctx;

  if (chat.id === from.id) {
    return false;
  }

  const admins = await ctx.telegram.getChatAdministrators(chat.id);
  if (!lo.find(admins, { id: from.id })) {
    return false;
  }

  const notAuthorized = [
    `⚠ <b>${from.first_name}</b> may not do setting in chat id <code>${chat.id}</code>`,
  ];

  await ctx.replyWithHTML(notAuthorized.join(' '));
  return true;

}
