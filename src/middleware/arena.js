import map from 'lodash/map';
import get from 'lodash/get';
import uniq from 'lodash/uniq';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import maxBy from 'lodash/maxBy';
import sumBy from 'lodash/sumBy';
import mapKeys from 'lodash/mapKeys';
import filter from 'lodash/filter';
import last from 'lodash/last';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import fpGet from 'lodash/fp/get';

import { format, addDays, addHours } from 'date-fns';

import log from '../services/log';
import Duel from '../models/Duel';
import User from '../models/User';
import * as ar from '../services/arena';
import { LEVEL_ICON } from './profile';

const { debug, error } = log('mw:arena');

const DUEL_RESET_HOUR = parseFloat(process.env.DUEL_RESET_HOUR) || 10.25;

export async function arena(ctx) {

  const { from: { id: fromUserId }, message } = ctx;
  const { match, state: { match: stateMatch } } = ctx;
  const [, name, shiftParam = '0', shiftHigh = shiftParam] = stateMatch || match;

  let { cwId } = ctx.state;

  debug(fromUserId, message.text, `"${name || cwId}"`, shiftParam, shiftHigh);

  await ctx.replyWithChatAction('typing');

  try {

    const shift = parseInt(shiftParam, 0) || 0;
    const shiftTo = shiftHigh ? parseInt(shiftHigh, 0) : shift;
    const [, tag] = name.match(/\[(.+)\]/) || [];

    if (shift < shiftTo) {
      await ctx.replyWithHTML(`Invalid param <b>${shift}</b> less than <b>${shiftTo}</b>`);
      return;
    }

    if (tag) {

      const { period, res: data, opponents } = await guildDuels(tag, shift, shiftTo);

      const reply = [
        `<b>[${tag}]</b> duels ${period}`,
        '',
        ...map(data, formatGuildMemberDuels),
        '',
        `<b>${data.length}</b> fighters ${gainInfo(opponents)} won ${formatGuildTotalDuels(data)}`,
      ];

      await ctx.replyWithHTML(reply.join('\n'));

    } else {

      if (!cwId) {
        cwId = await ar.lastKnownUserID(name);
      }

      if (!cwId) {
        await ctx.replyWithHTML(formatDuels([], cwId, name));
        return;
      }

      const cond = {
        ...duelTimeFilter(shift, shiftTo),
        'players.id': cwId,
      };

      const data = await Duel.find(cond).sort('-ts');

      await ctx.replyWithHTML(formatDuels(data, cwId, name));

    }

    debug('GET /du', name);

  } catch (e) {
    error(e.message);
    ctx.replyError('/du', e);
  }

}

export async function ownArena(ctx) {

  const { from: { id: fromUserId }, message, session } = ctx;
  const [, shiftParam, shiftHigh] = ctx.match || [message.text];

  const dug = /^\/dug( |@|$)/.test(message.text);

  debug('ownArena', message.text);

  let name = '';

  if (session.auth) {

    const user = await User.findOne({ id: fromUserId });

    if (!user) {
      await ctx.replyWithHTML('Click /hello to update your game info then try /du again');
      return;
    }

    if (user) {
      const { profile } = user;
      name = dug ? `[${profile.guild_tag}]` : profile.userName;
    }

    if (!dug) {
      ctx.state.cwId = session.auth.id;
    }

  }

  if (!name && !ctx.state.cwId) {
    await replyHelp(ctx);
    return;
  }

  ctx.state.match = [message.text, name, shiftParam, shiftHigh];

  await arena(ctx);

}

function duelKey(nameOrTag) {
  const tag = nameOrTag.match(/\[(.+)]/);
  return tag ? { tag: tag[1] } : { name: nameOrTag };
}

function fpMapKeys(mapper) {
  return obj => mapKeys(obj, mapper);
}

export async function vsArena(ctx) {

  const { match } = ctx;

  const [, p1, p2] = match || [];

  const winner = fpMapKeys((val, key) => `winner.${key}`);
  const loser = fpMapKeys((val, key) => `loser.${key}`);

  const p1Key = duelKey(p1);
  const p2Key = duelKey(p2);

  debug('vsArena', p1Key, p2Key);

  const p1Won = await Duel.find({
    ...winner(p1Key),
    ...loser(p2Key),
  });

  const p2Won = await Duel.find({
    ...winner(p2Key),
    ...loser(p1Key),
  });

  const total = p2Won.length + p1Won.length;

  if (!total) {
    await ctx.replyWithHTML(`Not found duels of <b>${p1}</b> vs <b>${p2}</b>`);
    return;
  }

  let wonTimes = p1Won.length ? `won <b>${p1Won.length}</b> times` : 'never won';

  if (p1Won.length === 1) {
    wonTimes = 'won only <b>once</b>';
  }

  const title = [
    `<b>${p1}</b>`,
    wonTimes,
    `over <b>${p2}</b> in <b>${total}</b> duel${total > 1 ? 's' : ''}`,
  ];

  const reply = [
    title.join(' '),
  ];

  if ((p2Key.tag && !p1Key.tag) || (p1Key.tag && !p2Key.tag)) {

    const key1 = p2Key.tag ? 'loser' : 'winner';
    const key2 = p2Key.tag ? 'winner' : 'loser';

    const p1WonGrouped = groupBy(p1Won, ({ [key1]: { name } }) => name);
    const p2WonGrouped = groupBy(p2Won, ({ [key2]: { name } }) => name);

    const opponents = orderBy(uniq([
      ...Object.keys(p1WonGrouped),
      ...Object.keys(p2WonGrouped),
    ]));

    const winRates = map(opponents, name => {
      const winCount = get(p1WonGrouped[name], 'length') || 0;
      const loseCount = get(p2WonGrouped[name], 'length') || 0;
      return `${name}: <b>${winCount}</b>/<b>${loseCount}</b>`;
    });

    reply.push(
      '',
      ...winRates,
    );

  }

  await ctx.replyWithHTML(reply.join('\n'));

}


function replyHelp(ctx) {
  const help = [
    'Try /du username or /du [TAG] (case sensitive)',
    'Authorize this bot with /auth to use /du without params for you or /dug for your guild',
  ];
  return ctx.replyWithHTML(help.join(' '));
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
  return [
    duels.gainInfo,
    winRateBold([won, lost]).join('/'),
    // `<b>${won}</b>/<b>${lost}</b>`,
    name,
    `<code>${level}</code>`,
  ].join(' ');
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

  const cond = { 'players.tag': tag };

  const tf = duelTimeFilter(shift, shiftTo);

  Object.assign(cond, tf);

  const duels = await Duel.find(cond);

  if (!duels.length) {
    throw new Error('not found duels');
  }

  const opponents = duelOpponents(duels, { tag });

  debug('guildDuels', opponents.length);

  const byName = groupBy(opponents, fpGet('player.name'));


  const res = map(byName, (nameDuels, name) => {

    const { wins = [], loses = [] } = groupBy(nameDuels, ({ isWinner }) => (isWinner ? 'wins' : 'loses'));
    const { player: { level } } = maxBy(nameDuels, fpGet('player.level'));

    const won = wins.length;
    const lost = loses.length;

    return {
      gain: gainTotal(nameDuels),
      gainInfo: gainInfo(nameDuels),
      name,
      level,
      won,
      lost,
      rate: won - lost,
    };
  });

  const period = formatPeriod(duels);

  return {
    period,
    opponents,
    res: orderBy(res, ['rate', 'level'], ['desc', 'desc']),
  };

}

const hours = Math.floor(DUEL_RESET_HOUR);
const minutes = (DUEL_RESET_HOUR - hours) * 60;


function duelTimeFilter(shift, shiftTo = shift) {

  const today = addDays(new Date(), -shiftTo);
  let $lt = addDays(new Date(), -shiftTo);

  $lt.setHours(hours, minutes, 0, 0);

  if ($lt < today) {
    $lt = addDays($lt, 1);
  }

  const $gt = addDays($lt, shiftTo - shift - 1);

  debug('duelTimeFilter', shift, shiftTo, $gt, $lt);

  return { ts: { $gt, $lt } };

}

function dateFormat(date) {
  return format(date, 'DD/MM');
}

function dateToCW(date) {
  return addHours(date, -DUEL_RESET_HOUR);
}

function formatDuels(duels, id, primaryName) {

  if (!duels.length) {
    return `Duels of <b>${primaryName}</b> not found`;
  }

  const opponents = duelOpponents(duels, { id });

  const { ts: maxTs, player: duelPlayer } = opponents[0];
  const { ts: minTs } = last(opponents);

  const minDate = dateFormat(minTs);
  const maxDate = dateFormat(maxTs);

  const isPeriod = minDate !== maxDate && opponents.length > 10;

  const period = isPeriod
    ? `from <b>${minDate}</b> to <b>${maxDate}</b>` : `on <b>${minDate}</b>`;

  const { tag, level, name } = duelPlayer;

  const winRate = [wonOver(opponents).length, lostTo(opponents).length];

  return [
    `${LEVEL_ICON}${level} <b>${tag ? `[${tag}] ` : ''}${name}</b>`,
    `${gainInfo(opponents)} for duels ${period}`,
    '',
    isPeriod ? statsByDate() : wonLostList(),
    '',
    `Total ${winRateBold(winRate).join('/')}`,
  ].join('\n');

  function wonLostList() {

    return [
      opponentList(wonOver(opponents), 'Won'),
      '',
      opponentList(lostTo(opponents), 'Lost'),
    ].join('\n');

  }

  function statsByDate() {

    const byDate = groupBy(opponents, ({ ts }) => dateFormat(ts));

    if (Object.keys(byDate).length < 60) {
      return statsByDatePart(byDate);
    }

    const byWeek = groupBy(opponents, ({ ts }) => format(ts, 'Wo week'));

    return statsByDatePart(byWeek);

  }

}

function statsByDatePart(stats) {
  return map(stats, (dateOpponents, datePart) => {

    const winRate = [
      wonOver(dateOpponents).length,
      lostTo(dateOpponents).length,
    ];

    const gain = gainTotal(dateOpponents);

    return [
      `<code>${datePart}</code>`,
      winRateBold(winRate).join(' / '),
      // `(${gain > 0 ? '👍' : ''}${gain})`,
      gain > 0 ? `👍 ${gain}` : `(${gain})`,
      // gainInfo(dateOpponents),
      winRateIcon(winRate),
    ].join(' ');

  }).join('\n');
}

function winRateBold(winRate) {
  const total = sumBy(winRate);
  return winRate.map(rate => {
    const isBold = rate >= total / 2;
    return isBold ? `<b>${rate}</b>` : rate;
  });
}

function winRateIcon(winRate) {

  const total = sumBy(winRate);
  const prizes = ['🥇', '🥈', '🥉'];
  const prize = total - winRate[0];

  return (prize < prizes.length) ? prizes[prize] : '';

}

function wonOver(opponents) {
  return filter(opponents, 'isWinner');
}

function lostTo(opponents) {
  return filter(opponents, { isWinner: false });
}

function duelOpponents(duels, cond) {

  return filter(map(duels, duel => {

    const { winner, loser, isChallenge } = duel;

    const isWinner = isEqual(cond, pick(winner, Object.keys(cond)));

    const player = isWinner ? winner : loser;
    const opponent = isWinner ? loser : winner;

    const { hp: undamaged } = opponent;

    return {
      isWinner,
      opponent,
      player,
      ...opponent,
      isChallenge,
      undamaged,
      saved: player.hp,
      // ts: duel.ts,
      ts: dateToCW(duel.ts),
    };

  }));

}


function gainTotal(opponents) {
  return sumBy(opponents, duel => {
    const { saved, undamaged } = duel;
    return saved - undamaged;
  });

}

function gainInfo(opponents) {
  const gain = gainTotal(opponents);
  return gain ? `${gain > 0 ? `❤+${gain}` : `💔-${-gain}`}` : '⚡️';
}


function opponentList(opponents, type) {

  if (!opponents.length) {
    return `${type}: none`;
  }

  return [
    `${gainInfo(opponents)}`,
    ...map(opponents, opponentFormat),
  ].join('\n');

}


function opponentFormat(duel) {

  const { opponent } = duel;
  const { castle, tag, name } = opponent;
  const { isChallenge, level } = opponent;
  // const { saved, undamaged } = duel;
  const gain = gainTotal([duel]);

  return filter([
    `<code>${level}</code>`,
    castle,
    tag ? `[${tag}]` : '',
    isChallenge ? '🤺‍' : '',
    name,
    `<b>${gain > 0 ? '+' : ''}${gain}</b>`,
  ]).join(' ');

}
