import lo from 'lodash';
import log from '../services/log';
import Chat, * as c from '../models/Chat';

const { debug } = log('chat');

const SETTING_NAMES = [
  c.CHAT_SETTING_NOTIFY_BATTLE,
  c.CHAT_SETTING_MOB_HUNTING,
  c.CHAT_SETTING_PIN_MOBS,
  c.CHAT_SETTING_HELPERS_MIN_HP,
  c.CHAT_SETTING_CALL_HELPERS,
  c.CHAT_SETTING_HELPERS_LOW_THRESHOLD,
  c.CHAT_SETTING_ALLIANCE_INFO,
  c.CHAT_SETTING_NOTIFY_ALLIANCE_BATTLE,
];

export async function setting(ctx) {

  const { chat, match: [, name, onOff] } = ctx;

  if (await ifNotPermitted(ctx)) {
    return;
  }

  if (await ifInvalidSetting(ctx, name)) {
    return;
  }

  const value = settingTypedValue(onOff, name);
  await Chat.saveValue(chat.id, name, value);
  await ctx.replyWithHTML(settingView(chat.id, name, 'from now on is', value));

}


function settingTypedValue(stringValue, name) {

  switch (name) {
    case c.CHAT_SETTING_HELPERS_MIN_HP:
    case c.CHAT_SETTING_HELPERS_LOW_THRESHOLD:
      return parseInt(stringValue, 0);
    default:
      return /^(on|true|1)$/.test(stringValue);
  }

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
    const typed = lo.isBoolean(value) && (value ? 'on' : 'off') || value;
    return `<code>${name}</code>: <b>${typed}</b>`;
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
