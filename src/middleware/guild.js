import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import { addHours, differenceInMinutes } from 'date-fns';
import lo from 'lodash';
import * as gi from '../services/guilding';
import * as usr from '../services/users';
import * as b from '../services/battles';
import { getOwnGuild } from '../services/profile';
import { isChatAdmin } from '../services/util';
import { fromCWFilter } from '../config/filters';
import Chat, { CHAT_SETTING_GPIN_AUTO } from '../models/Chat';

const STATES_TO_NOT_NOTIFY = [gi.STATES.ATTACK, gi.STATES.DEFEND, gi.STATES.SNOOZE];

export function daFilterFromCW(ctx) {
  return fromCWFilter(ctx) && gi.DA_HEADER_RE.test(ctx.message.text);
}

export async function guildDAInfo(ctx) {

  const { text, forward_date: forwardDateInt } = ctx.message;
  const da = gi.parseDAList(text);

  if (!da) {
    return;
  }

  const forwardDate = new Date(forwardDateInt * 1000);
  const forwardBattle = addHours(forwardDate, b.BATTLE_HOUR);

  const lastBattle = b.battleDate(forwardDate);
  const nextBattle = b.nextDate(lastBattle);

  const minutesToLast = differenceInMinutes(forwardBattle, lastBattle);
  const minutesToNext = differenceInMinutes(nextBattle, forwardBattle);

  const lastOrNext = minutesToLast < minutesToNext;

  const battle = lastOrNext ? lastBattle : nextBattle;
  const afterBefore = lastOrNext ? 'after' : 'before';
  const minutes = lastOrNext ? minutesToLast : minutesToNext;

  const reply = [
    `${da.castleIcon} <b>${da.guildName}</b>`,
    `Total ${da.type}: <b>${da.total()}</b>`,
    `<b>${minutes}</b> minutes ${afterBefore} <b>${b.dateFormat(battle)}</b> battle`,
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function guildPin(ctx) {

  const [, silent] = ctx.match;

  const { reply_to_message: { text: rosterText } = {} } = ctx.message;

  if (!rosterText) {
    return;
  }

  if (!fromCWFilter({ message: ctx.message.reply_to_message })) {
    await ctx.replyWithHTML('️🚫 not a forward from ChatWars');
    return;
  }

  if (!await isChatAdmin(ctx)) {
    await ctx.replyWithHTML('️🚫 you\'re not a chat admin');
    return;
  }

  await doGuildPin(ctx, rosterText, silent);

}

export function rosterFilter(ctx) {
  const { message: { text } = {}, state } = ctx;
  if (!text || !fromCWFilter(ctx)) {
    return false;
  }
  const lines = text.split('\n');
  state.rosterText = text;
  return gi.ROSTER_HEADER_RE.test(lines[0]) && gi.ROSTER_LINE_RE.test(lines[1]);
}

export async function onRosterForward(ctx) {
  const { rosterText } = ctx.state;
  if (!await Chat.findValue(ctx.chat.id, CHAT_SETTING_GPIN_AUTO)) {
    return;
  }
  await doGuildPin(ctx, rosterText);
}

async function doGuildPin(ctx, rosterText, silent = false) {

  const { guildName, players } = gi.parseRoster(rosterText);
  const ownGuild = getOwnGuild(ctx);

  if (ownGuild !== guildName) {
    await ctx.replyWithHTML('️🚫 not your guild');
    return;
  }

  const toNotify = players.filter(({ state }) => STATES_TO_NOT_NOTIFY.indexOf(state) === -1);

  const users = await usr.usersFromCWNames(lo.map(toNotify, 'name'), guildName);

  if (!toNotify.length) {
    await ctx.replyWithHTML('👍 nobody to pin');
    return;
  }

  if (!users.length) {
    await ctx.replyWithHTML('💁‍♂️ nobody to pin');
    return;
  }

  const chunks = lo.chunk(users.map(u => {
    const ping = `@${u.username}`;
    return silent ? `<code>${ping}</code>` : ping;
  }), 3);

  await eachSeriesAsync(chunks, async replyChunk => {
    await ctx.replyWithHTML(replyChunk.join(' '));
    await new Promise(resolve => setTimeout(resolve, 500));
  });

}
