import map from 'lodash/map';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import maxBy from 'lodash/maxBy';
import sumBy from 'lodash/sumBy';
import filter from 'lodash/filter';
import last from 'lodash/last';
import { format, addDays } from 'date-fns';

import log from '../services/log';
import Duel from '../models/Duel';
import { refreshProfile } from '../services/auth';

const { debug, error } = log('mw:arena');

const DUEL_RESET_HOUR = parseFloat(process.env.DUEL_RESET_HOUR) || 3;

export default async function (ctx) {

  const { from: { id: fromUserId }, message, session } = ctx;
  const { match } = ctx;
  const [, nameArg, shiftParam = '0', shiftHigh = shiftParam] = match || [message.text];

  debug(fromUserId, message.text, `"${nameArg}"`, shiftParam, shiftHigh);

  try {

    let name = nameArg;

    if (!name && session.auth) {
      const profile = await refreshProfile(fromUserId);
      name = message.text === '/dug' ? `[${profile.guild_tag}]` : profile.userName;
    }

    if (!name) {
      await replyHelp(ctx);
      return;
    }

    const shift = parseInt(shiftParam, 0) || 0;
    const shiftTo = shiftHigh ? parseInt(shiftHigh, 0) : shift;
    const [, tag] = name.match(/\[(.+)\]/) || [];

    if (shift < shiftTo) {
      await ctx.replyWithHTML(`Invalid param <b>${shift}</b> less than <b>${shiftTo}</b>`);
      return;
    }

    if (tag) {

      const { period, res: data } = await guildDuels(tag, shift, shiftTo);

      const reply = [
        `<b>[${tag}]</b> duels ${period}\n`,
        ...map(data, formatGuildMemberDuels),
        `\n<b>${data.length}</b> active fighters won ${formatGuildTotalDuels(data)}`,
      ];

      await ctx.replyWithHTML(reply.join('\n'));

    } else {

      const cond = {
        $or: [{ 'winner.name': name }, { 'loser.name': name }],
        ...duelTimeFilter(shift, shiftTo),
      };

      const data = await Duel.find(cond).sort('-ts');

      await ctx.replyWithHTML(formatDuels(data, name));

    }

    debug('GET /du', name);

  } catch (e) {
    error(e.message);
    ctx.replyError('/du', e);
  }

}


function replyHelp(ctx) {
  return ctx.replyWithHTML('Try /du username|[TAG] or do /auth to use /du without params');
}

function formatGuildTotalDuels(duels) {
  return `<b>${sumBy(duels, 'won') || 0}</b> lost <b>${sumBy(duels, 'lost') || 0}</b>`;
}

function formatGuildMemberDuels(duels) {
  const {
    name,
    won,
    lost,
    level,
  } = duels;
  return `<code>${level}</code> ${name}: <b>${won}</b>/<b>${lost}</b>`;
}


function formatPeriod(duels) {

  const { ts: maxTs } = duels[0];
  const { ts: minTs } = last(duels);

  const minDate = dateFormat(minTs);
  const maxDate = dateFormat(maxTs);

  return minDate !== maxDate
    ? `from <b>${minDate}</b> to <b>${maxDate}</b>` : `on <b>${minDate}</b>`;

}


async function guildDuels(tag, shift, shiftTo) {

  const cond = { $or: [{ 'winner.tag': tag }, { 'loser.tag': tag }] };

  const tf = duelTimeFilter(shift, shiftTo);

  Object.assign(cond, tf);

  const duels = await Duel.find(cond);

  if (!duels.length) {
    throw new Error('not found duels');
  }

  const named = map(duels, duel => {

    const { winner, loser } = duel;
    const isWinner = winner.tag === tag;
    const name = isWinner ? winner.name : loser.name;
    const result = isWinner ? 'won' : 'lost';
    const opponentName = isWinner ? loser.name : winner.name;
    const level = isWinner ? winner.level : loser.level;

    return {
      ...duel,
      name,
      result,
      opponentName,
      level,
    };

  });

  const res = map(groupBy(named, 'name'), (nameDuels, name) => {
    const { won = [], lost = [] } = groupBy(nameDuels, 'result');
    const { level } = maxBy(nameDuels, 'level');
    return {
      name,
      level,
      won: won.length,
      lost: lost.length,
    };
  });

  const period = formatPeriod(duels);

  return { period, res: orderBy(res, ['level', 'name'], ['desc', 'asc']) };

}


function duelTimeFilter(shift, shiftTo = shift) {

  const today = addDays(new Date(), -shiftTo);
  let $lt = addDays(new Date(), -shiftTo);

  const hours = Math.floor(DUEL_RESET_HOUR);
  const minutes = (DUEL_RESET_HOUR - hours) * 60;

  $lt.setHours(hours, minutes, 0, 0);

  if ($lt < today) {
    $lt = addDays($lt, 1);
  }

  const $gt = addDays($lt, shiftTo - shift - 1);

  debug('duelTimeFilter', shift, shiftTo, $gt, $lt);

  return { ts: { $gt, $lt } };

}

function dateFormat(date) {
  return format(date, 'D/MM');
}


function formatDuels(duels, primaryName) {

  const wonOver = filter(map(duels, duel => {
    const { winner, loser, isChallenge } = duel;
    return winner.name === primaryName && { ...loser, isChallenge };
  }));

  const lostTo = filter(map(duels, duel => {
    const { winner, loser, isChallenge } = duel;
    return (loser.name === primaryName) && { ...winner, isChallenge };
  }));

  if (!duels.length) {
    return `Duels of <b>${primaryName}</b> not found`;
  }

  const { ts: maxTs } = duels[0];
  const { ts: minTs } = last(duels);

  const minDate = dateFormat(minTs);
  const maxDate = dateFormat(maxTs);

  const period = minDate !== maxDate
    ? `from <b>${minDate}</b> to <b>${maxDate}</b>` : `on <b>${minDate}</b>`;

  return [
    `<b>${primaryName}</b> duels ${period}`,
    `Won${opponentList(wonOver)}`,
    `Lost${opponentList(lostTo)}`,
  ].join('\n\n');

  function opponentList(opponents) {

    if (!opponents.length) {
      return ': none';
    }

    return ` (<b>${opponents.length}</b>): \n\n${map(opponents, opponentFormat).join('\n')}`;

  }

  function opponentFormat(duel) {
    const { castle, tag, name } = duel;
    const { isChallenge } = duel;
    return filter([
      '\t',
      isChallenge ? '🤺‍' : '',
      castle,
      tag ? `[${tag}]` : '',
      name,
    ]).join(' ');
  }

}
