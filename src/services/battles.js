import { addHours, format } from 'date-fns';
import find from 'lodash/find';
import map from 'lodash/map';
import get from 'lodash/get';
import padStart from 'lodash/padStart';
import filter from 'lodash/filter';

import fpGet from 'lodash/fp/get';
import log from './log';

const { debug } = log('battles');

export const BATTLE_HOUR = parseInt(process.env.BATTLE_HOUR || '1', 0);
export const CASTLES_HASH = JSON.parse(process.env.CASTLES);

const BATTLE_EFFECTS = {
  battleCries: { test: 'Your battle cries were successful', icon: '🗣', label: 'Successful battle cries' },
  staminaRestored: { test: '🔋Stamina restored', icon: '🔋', label: 'Stamina restored' },
  luckyDefender: { test: '⚡Lucky Defender!', icon: '✌️', label: 'Lucky Defender' },
  criticalStrike: { test: '⚡Critical strike', icon: '⚡', label: 'Critical strike' },
  inspiredBy: { test: /⚡Battle Cry\. You were inspired by (.+)/, icon: '🤟', label: 'Inspired by' },
  taunts: { test: 'Your taunts were successful', icon: '🕺', label: 'Successful taunts' },
  medal: { test: /🏅(.+)/, icon: '🏅', label: '' },
  ga: { test: '🔱Guardian angel', icon: '🔱', label: 'Guardian angel' },
};

const { BATTLE_TEXT = 'Your result on the battlefield' } = process.env;
const BATTLE_TEXT_RE = new RegExp(BATTLE_TEXT);

const CASTLES = map(CASTLES_HASH, (castle, code) => ({ castle, code }));

const CASTLES_ICONS = map(CASTLES_HASH);
const BATTLE_STATS_RE = new RegExp(`(${CASTLES_ICONS.join('|')})(.*) ⚔:(.+) 🛡:(.+) Lvl: (\\d+)`);

const MOB_BATTLE_REPORT = /👾Encounter/i;

export function castleCode(castle) {
  return get(find(CASTLES, { castle }), 'code');
}

export function castleByCode(code) {
  return CASTLES_HASH[code];
}

export function dateFormat(date) {
  return `${battleIcon(date)} ${dayPart(date)}`;
}

export function dayPart(date) {
  return format(date, 'DD/MM');
}

export function dayTime(date) {
  return format(date, 'hh:mm DD/MM');
}

export function battleIcon(date) {
  const num = date.getUTCHours() / 8;
  return ['🌚', '🌝', '🌞'][num];
}

export function battleDate(reportDate) {

  const date = addHours(reportDate, BATTLE_HOUR);
  const hours = Math.floor(date.getUTCHours() / 8) * 8;

  date.setUTCHours(hours);
  date.setSeconds(0);
  date.setMinutes(0);
  date.setMilliseconds(0);

  return date;

}

export function dateCode(date) {
  const uh = date.getUTCHours();
  return `${format(date, 'YYMMDD')}_${padStart(uh, 2, '0')}`;
}

export function prevDate(date) {
  return addHours(date, -8);
}

export function nextDate(date) {
  return addHours(date, 8);
}

export function battleFromText(text, forwardDate) {

  if (!BATTLE_TEXT_RE.test(text)) {
    return null;
  }

  const results = filter(text.split('\n'), result => result && !BATTLE_TEXT_RE.test(result));
  const [, castle, nameFull] = text.match(BATTLE_STATS_RE) || [];
  const reportDate = new Date(forwardDate * 1000);
  const isMob = MOB_BATTLE_REPORT.test(text);

  let name = nameFull.replace(/🎗/, '');
  const tag = tagName(name);

  if (tag) {
    name = name.replace(/^[^[]+/, '');
  }

  debug('battleFromText', forwardDate, isMob ? 'mob' : 'battle', tag && `[${tag}]`, name);

  return {

    name,
    castle,
    results,
    reportDate,
    isMob,

    tag: tagName(name),
    date: isMob ? reportDate : battleDate(reportDate),
    stats: battleStats(text),
    effects: battleEffects(results),

    gold: getValue('Gold'),
    exp: getValue('Exp'),
    hp: getValue('Hp'),
    hit: getValue('Hit'),
    miss: getValue('Miss'),
    lastHit: getValue('Last hit'),

  };

  function getValue(label) {
    const [, res] = text.match(`${label}: ([-]?\\d+)`) || [];
    return res ? parseInt(res, 0) : 0;
  }

}


function battleEffects(results) {

  const res = {};

  map(BATTLE_EFFECTS, ({ test }, key) => {

    const simple = find(results, result => {
      // debug(result, cond);
      return test === result;
    });

    if (simple) {
      res[key] = true;
      return;
    }

    const valued = find(results, result => result.match(test));

    if (valued) {
      const [, value] = valued.match(test);
      res[key] = value || '';
    }

  });

  return res;

}

function tagName(name) {
  const [, tag = null] = name.match(/\[(.+)\]/) || [];
  return tag;
}

function battleStats(text) {

  const [, , , atkInfo = '', defInfo = '', level] = text.match(BATTLE_STATS_RE) || [];

  // debug('battleStats:', text.match(BATTLE_STATS_RE));

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

export function effectIcon(val, e) {
  return fpGet('icon')(BATTLE_EFFECTS[e]);
}

export function effectInfo(val, e) {

  const { icon, label } = BATTLE_EFFECTS[e] || {};

  return filter([
    icon || '✅️',
    label,
    `${val && val !== true ? val : ''}`,
  ]).join(' ');

}
