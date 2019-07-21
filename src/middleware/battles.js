import { format, addHours } from 'date-fns';
import filter from 'lodash/filter';
import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import find from 'lodash/find';
// import last from 'lodash/last';

import log from '../services/log';

import { fromCWFilter } from '../config/filters';

import BattleReport from '../models/BattleReport';

const { debug } = log('mw:battles');

const BATTLE_HOUR = parseInt(process.env.BATTLE_HOUR || '1', 0);

const { BATTLE_TEXT = 'Your result on the battlefield' } = process.env;
const BATTLE_TEXT_RE = new RegExp(BATTLE_TEXT);

const CASTLES = map(JSON.parse(process.env.CASTLES));

const BATTLE_STATS_RE = new RegExp(`(${CASTLES.join('|')})(.*) .:(.+) ..:(.+) Lvl: (\\d+)`);

export function reportFilter(ctx) {

  const { state, message, from: { id: userId } } = ctx;
  const { text, forward_date: forwardDate } = message;

  if (!text && !fromCWFilter(ctx)) {
    return false;
  }

  const isReport = BATTLE_TEXT_RE.test(text);

  if (!isReport) {
    return false;
  }

  const results = filter(text.split('\n'), result => result && !BATTLE_TEXT_RE.test(result));
  const [, castle, name] = text.match(BATTLE_STATS_RE) || [];

  const reportDate = new Date(forwardDate * 1000);

  debug('reportFilter', isReport, forwardDate);

  const battle = {
    userId,
    castle,
    name,
    date: battleDate(reportDate),
    reportDate,
    results,
    stats: battleStats(results[0]),
    gold: getValue('Gold'),
    exp: getValue('Exp'),
    hp: getValue('Hp'),
    effects: battleEffects(results),
  };

  Object.assign(state, { battle });

  debug(battle);

  return isReport;

  function getValue(label) {
    const [, res] = text.match(`${label}: (\\d+)`) || [];
    return res ? parseInt(res, 0) : 0;
  }

}

export async function onReportForward(ctx) {

  const { state: { battle }, chat, from } = ctx;

  debug('onReportForward:', battle);

  await new BattleReport(battle).save();

  if (chat.id !== from.id) {
    return;
  }

  const reply = [
    `${battle.castle} Got <b>${battle.name}</b> report`,
    `for <b>${dateFormat(battle.date)}</b>`,
  ].join(' ');

  await ctx.replyWithHTML(reply);

}

function battleDate(reportDate) {

  const date = addHours(reportDate, BATTLE_HOUR);
  const hours = Math.floor(date.getUTCHours() / 8) * 8;

  date.setUTCHours(hours);
  date.setSeconds(0);
  date.setMinutes(0);

  return date;

}

function dateFormat(date) {
  return `${format(date, 'DD/MM')} ${battleIcon(date)}`;
}

function battleIcon(date) {
  const num = date.getUTCHours() / 8;
  return ['🌚', '🌝', '🌞'][num];
}

function battleStats(text) {

  const [, , , atkInfo = '', defInfo = '', level] = text.match(BATTLE_STATS_RE) || [];

  const [, atk, healAtk = '0'] = atkInfo.match(/(\d+)\(([-+]\d+)\)/) || ['', atkInfo];
  const [, def, healDef = '0'] = defInfo.match(/(\d+)\(([-+]\d+)\)/) || ['', defInfo];

  return {
    atk: parseInt(atk, 0),
    healAtk: parseInt(healAtk, 0),
    def: parseInt(def, 0),
    healDef: parseInt(healDef, 0),
    level: parseInt(level, 0),
  };

}

const BATTLE_EFFECTS = {
  staminaRestored: '🔋Stamina restored',
  luckyDefender: '⚡Lucky Defender!',
  criticalStrike: '⚡Critical strike',
  battleCry: /⚡Battle Cry\. You were inspired by (.+)/,
  medal: /🏅(.+)/,
};

function battleEffects(results) {

  return mapValues(BATTLE_EFFECTS, cond => {

    const simple = find(results, result => {
      // debug(result, cond);
      return cond === result;
    });

    if (simple) {
      return true;
    }

    const valued = find(results, result => result.match(cond));

    if (valued) {
      return valued.match(cond)[1];
    }

    return undefined;

  });

}
