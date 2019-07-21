import { format, addHours } from 'date-fns';
import filter from 'lodash/filter';
import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import find from 'lodash/find';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import fpGet from 'lodash/fp/get';
import fpSumBy from 'lodash/fp/sumBy';

import log from '../services/log';
import { fromCWFilter } from '../config/filters';

import BattleReport from '../models/BattleReport';
// import User from '../models/User';

const { debug, error } = log('mw:battles');

const BATTLE_HOUR = parseInt(process.env.BATTLE_HOUR || '1', 0);
const { BATTLE_TEXT = 'Your result on the battlefield' } = process.env;
const BATTLE_TEXT_RE = new RegExp(BATTLE_TEXT);
const CASTLES = map(JSON.parse(process.env.CASTLES));
const BATTLE_STATS_RE = new RegExp(`(${CASTLES.join('|')})(.*) .:(.+) ..:(.+) Lvl: (\\d+)`);

const ADMIN_ID = parseInt(process.env.ADMIN_ID, 0);

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
    tag: tagName(name),
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


export async function userReport(ctx) {

  const { from: { id: userId } } = ctx;

  const report = await BattleReport.findOne({ userId }).sort({ date: -1 });

  if (!report) {
    return;
  }

  const { effects, name } = report;
  const { stats: { atk, def }, exp, gold } = report;

  const reply = [
    `${report.castle} <b>${name}</b> battle report`,
    '',
    `<b>${dateFormat(report.date)}</b> 🔥${exp} 💰${gold} ⚔️${atk} 🛡${def}`,
    '',
    ...map(effects, effectInfo),
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function guildReport(ctx) {

  const { session: { profile }, from: { id: userId } } = ctx;

  if (!profile) {
    return;
  }

  const { guild_tag: ownTag } = profile;
  const [, matchTag] = (userId === ADMIN_ID && ctx.match) || ['', ownTag];

  const tag = matchTag || ownTag;

  if (!tag) {
    error('rbg', ownTag, ctx.match);
    return;
  }

  const tagReports = await BattleReport.find({ tag }).sort({ date: -1 }).limit(20);

  debug('rbg', tag, tagReports.length);

  if (!tagReports.length) {
    return;
  }

  const { date } = tagReports[0];

  const dateReports = orderBy(filter(tagReports, { date }), ['exp'], ['desc']);

  const reports = groupBy(dateReports, fpGet('name'));

  const totals = mapValues(
    { atk: '⚔', def: '🛡' },
    (val, key) => `${val}${fpSumBy(fpGet(`stats.${key}`))(dateReports) || 0}`,
  );

  const reply = [

    `<b>[${tag}]</b> battle report on ${dateFormat(date)}`,
    '',
    map(reports, (userReports, name) => {

      const report = userReports[0];
      const { effects } = report;

      const { stats: { atk, def, level }, exp, gold } = report;

      return [
        [`<code>${level}</code> <b>${name.replace(/(\[.+])/, '')}</b>`,
          ...map(effects, effectIcon)].join(' '),
        `🔥${exp} 💰${gold} ⚔️${atk} 🛡${def}`,
      ].join('\n');

    }).join('\n'),
    '',
    `👤${dateReports.length} ${totals.atk} ${totals.def}`,
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}


function tagName(name) {
  const [, tag = null] = name.match(/\[(.+)\]/) || [];
  return tag;
}

function effectInfo(val, e) {
  return `✅️ ${e}${val && val !== true ? `: ${val}` : ''}`;
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
  return `${battleIcon(date)} ${format(date, 'DD/MM')}`;
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
  staminaRestored: { test: 'Stamina restored', icon: '🔋' },
  luckyDefender: { test: '⚡Lucky Defender!', icon: '⚡' },
  criticalStrike: { test: '⚡Critical strike', icon: '⚡' },
  inspiredBy: { test: /⚡Battle Cry\. You were inspired by (.+)/, icon: '🤟' },
  taunts: { test: 'Your taunts were successful', icon: '🕺' },
  medal: { test: /🏅(.+)/, icon: '🏅' },
  ga: { test: '🔱Guardian angel', icon: '🔱' },
};

function effectIcon(val, e) {
  return fpGet('icon')(BATTLE_EFFECTS[e]);
}

function battleEffects(results) {

  return mapValues(BATTLE_EFFECTS, ({ test }) => {

    const simple = find(results, result => {
      // debug(result, cond);
      return test === result;
    });

    if (simple) {
      return true;
    }

    const valued = find(results, result => result.match(test));

    if (valued) {
      return valued.match(test)[1];
    }

    return undefined;

  });

}
