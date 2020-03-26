import find from 'lodash/find';

import groupBy from 'lodash/groupBy';
import fpGet from 'lodash/fp/get';
import map from 'lodash/map';
import maxBy from 'lodash/maxBy';
import orderBy from 'lodash/orderBy';
import { addDays, addHours, format } from 'date-fns';
import last from 'lodash/last';
import filter from 'lodash/filter';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import log from './log';
import Duel from '../models/Duel';

const { debug } = log('arena');

const DUEL_RESET_HOUR = parseFloat(process.env.DUEL_RESET_HOUR) || 10.25;

const hours = Math.floor(DUEL_RESET_HOUR);
const minutes = (DUEL_RESET_HOUR - hours) * 60;

debug('DUEL_RESET_HOUR', hours, minutes);

export function duelTimeFilter(shift, shiftTo = shift) {

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

export function dateFormat(date) {
  return format(date, 'DD/MM');
}

export function dateToCW(date) {
  return addHours(date, -DUEL_RESET_HOUR);
}


export async function lastKnownUserID(name) {

  const lastDuel = await Duel.findOne({
    'players.name': name,
  }).sort({ _id: -1 });

  if (!lastDuel) {
    return null;
  }

  const player = find(lastDuel.players, { name });

  // debug('lastKnownUserID:', name, lastDuel, player);

  return player && player.id;

}

export async function guildDuels(tag, shift, shiftTo) {

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
      // gain: gainTotal(nameDuels),
      // gainInfo: gainInfo(nameDuels),
      level,
      name,
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

function formatPeriod(duels) {

  const { ts: maxTs } = duels[0];
  const { ts: minTs } = last(duels);

  const minDate = dateFormat(minTs);
  const maxDate = dateFormat(maxTs);

  return minDate !== maxDate
    ? `from <b>${minDate}</b> to <b>${maxDate}</b>` : `on <b>${minDate}</b>`;

}

export function duelOpponents(duels, cond) {

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
