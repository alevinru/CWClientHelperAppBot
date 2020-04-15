import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import lo from 'lodash';
import * as gi from '../services/guilding';
import * as usr from '../services/users';
import { getOwnGuild } from '../services/profile';
import { isChatAdmin } from '../services/util';
import { fromCWFilter } from '../config/filters';

const STATES_TO_NOT_NOTIFY = [gi.STATES.ATTACK, gi.STATES.DEFEND, gi.STATES.SNOOZE];

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
