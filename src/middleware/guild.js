import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import { addHours, differenceInMinutes } from 'date-fns';
import lo from 'lodash';
import * as gi from '../services/guilding';
import * as usr from '../services/users';
import * as b from '../services/battles';
import { getOwnGuild } from '../services/profile';
import { isChatAdmin } from '../services/util';
import { fromCWFilter } from '../config/filters';

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

  const ownGuild = getOwnGuild(ctx);

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

  const { guildName, players } = gi.parseRoster(rosterText);

  if (ownGuild !== guildName) {
    await ctx.replyWithHTML('️🚫 not your guild');
    return;
  }

  const toNotify = players.filter(({ state }) => STATES_TO_NOT_NOTIFY.indexOf(state) === -1);

  const users = await usr.usersFromCWNames(lo.map(toNotify, 'name'));

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
