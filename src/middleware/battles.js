import { format, addHours, differenceInHours } from 'date-fns';
import filter from 'lodash/filter';
import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import find from 'lodash/find';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import fpGet from 'lodash/fp/get';
import fpSumBy from 'lodash/fp/sumBy';
import omit from 'lodash/omit';
import set from 'lodash/set';
import max from 'lodash/max';

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

const MOB_BATTLE_REPORT = /Hit.*\nMiss/i;

const ADMIN_ID = parseInt(process.env.ADMIN_ID, 0);

const aggregate = path => fpSumBy(fpGet(path));

export function reportFilter(ctx) {

  const { state, message, from: { id: userId } } = ctx;
  const { text, forward_date: forwardDate } = message;

  if (!text || !fromCWFilter(ctx)) {
    return false;
  }

  const isReport = BATTLE_TEXT_RE.test(text);

  if (!isReport) {
    return false;
  }

  if (MOB_BATTLE_REPORT.test(text)) {
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
    const [, res] = text.match(`${label}: ([-]?\\d+)`) || [];
    return res ? parseInt(res, 0) : 0;
  }

}

export async function onReportForward(ctx) {

  const { state: { battle }, chat, from } = ctx;

  debug('onReportForward:', battle);

  const { date, name } = battle;
  const key = { date, name };

  const $setOnInsert = omit(battle, ['date', 'name', 'gold']);

  await BattleReport.updateOne(key, {
    $setOnInsert,
    $set: {
      ts: new Date(),
      gold: battle.gold,
    },
    // $currentDate: { ts: true },
  }, { upsert: true });

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

  const { from: { id: userId }, match } = ctx;

  const [, reportId] = match;

  debug('userReport', userId, reportId);

  const filters = reportId ? { _id: reportId } : { userId };

  const reply = await userReportByDate(filters);

  await ctx.replyWithHTML(reply.join('\n'));

}


export async function userReportForPeriod(ctx) {

  const { match, session: { profile } } = ctx;
  const [, from, to] = match;

  if (!profile || !from) {
    return;
  }

  const battles = parseInt(from, 0) || 1;

  const { userName, guild_tag: tag } = profile;

  const name = `${tag && `[${tag}]`}${userName}`;

  const dateE = battleDate(new Date());

  const dateB = addHours(dateE, (1 - battles) * 8);

  debug('userReportForPeriod', name, from, to, dateB);

  const reply = await userReportByDate({ name }, dateB, dateE);

  await ctx.replyWithHTML(reply.join('\n'));

}


async function userReportByDate(filters, dateB, dateE) {

  if (dateB) {
    set(filters, 'date.$gte', dateB);
    if (dateE) {
      set(filters, 'date.$lte', dateE);
    }
  }

  const query = BattleReport.find(filters).sort({ date: -1 });

  if (!dateB) {
    query.limit(1);
  }

  const reports = await query;

  if (!reports.length) {
    return [`No battle report found for <b>${JSON.stringify(filters)}</b>`];
  }

  const rows = reports.map(report => {

    const { stats: { atk, def }, exp, gold } = report;
    const icons = map(report.effects, effectIcon).join('');

    return filter([
      `<b>${dateFormat(report.date)}</b> ${reports.length > 1 ? icons : ''}`,
      ` ⚔️${atk} 🛡${def} 🔥${exp} 💰${gold}`,
    ]).join('\n');

  });

  const { stats: { level }, name, castle } = reports[0];

  const res = [
    `<code>${level}</code> ${castle} <b>${name}</b> battle report`,
    '',
    rows.join('\n\n'),
  ];

  if (reports.length === 1) {
    res.push(
      '',
      map(reports[0].effects, effectInfo).join('\n'),
    );
  } else {

    const battlesCnt = differenceInHours(dateE, dateB) / 8 + 1;

    const attendInfo = `<b>${reports.length}/${battlesCnt}</b>`;

    res.push(
      '',
      `${attendInfo} 🔥${aggregate('exp')(reports)} 💰${aggregate('gold')(reports)}`,
    );
  }

  return res;

}

export async function guildReport(ctx) {

  const { session: { profile }, from: { id: userId } } = ctx;

  if (!profile) {
    return;
  }

  const { guild_tag: ownTag } = profile;
  const [, matchTag] = (userId === ADMIN_ID && ctx.match) || ['', ownTag];

  const [, daysMatch] = ctx.match;

  const days = parseInt(daysMatch, 0) || 1;
  const tag = ownTag || matchTag;

  if (!tag) {
    error('rbg', ownTag, ctx.match);
    return;
  }

  const lastReports = await BattleReport.find({ tag })
    .sort({ date: -1 })
    .limit(1);

  debug('rbg', tag, days, lastReports.length);

  if (!lastReports.length) {
    return;
  }

  const { date } = lastReports[0];
  const $gte = addHours(date, (1 - days) * 8);

  const repFilter = {
    tag,
    date: { $lte: date, $gte },
  };

  const tagReports = await BattleReport.find(repFilter)
    .sort({ date: -1 });

  const dateReports = orderBy(tagReports, ['exp'], ['desc']);

  const groupedReports = groupBy(dateReports, ({ name }) => name.replace(/🎗/, ''));

  const groups = map(groupedReports, (userReports, name) => ({ userReports, name }));

  const reports = orderBy(groups, ({ userReports }) => -aggregate('exp')(userReports));

  const totals = mapValues(
    { atk: '⚔', def: '🛡' },
    (val, key) => `${val}${aggregate(`stats.${key}`)(dateReports) || 0}`,
  );

  totals.exp = `🔥${aggregate('exp')(dateReports)}`;
  totals.gold = `💰${aggregate('gold')(dateReports)}`;

  const formatter = days > 1 ? guildUserWeeklyReport : guildUserDayReport;

  const dateLabel = [dateFormat(date)];

  if (days > 1) {
    dateLabel.splice(0, 0, [`for <b>${days}</b> battles`, `from ${dateFormat($gte)} to`].join('\n'));
  }

  const reply = [
    `<b>[${tag}]</b> battle report ${dateLabel.join(' ')}`,
    [`\n👤${reports.length}`, totals.exp, totals.gold].join(' '),
    '',
    map(reports, formatter).join('\n\n'),
    '',
  ];

  if (days <= 1) {
    reply.push(['Total:', totals.atk, totals.def].join(' '));
  }

  await ctx.replyWithHTML(reply.join('\n'));

}

function guildUserWeeklyReport({ userReports, name }) {

  // const { effects } = groupBy(userReports, fpGet('effects.medal'));
  const level = max(map(userReports, fpGet('stats.level')));

  const totals = mapValues(
    { exp: '🔥', gold: '💰' },
    (val, key) => `${val}${aggregate(key)(userReports) || 0}`,
  );

  return [
    filter([
      `<code>${level}</code>`,
      `<b>${name.replace(/(\[.+])/, '')}</b>`,
      // map(effects, effectIcon).join(''),
    ]).join(' '),
    `👊${userReports.length} ${totals.exp} ${totals.gold}`,
  ].join('\n');

}

function guildUserDayReport({ userReports, name }) {

  const report = userReports[0];
  const { effects } = report;

  const { stats: { atk, def, level }, exp, gold } = report;

  return [
    filter([
      `<code>${level}</code>`,
      `<b>${name.replace(/(\[.+])/, '')}</b>`,
      map(effects, effectIcon).join(''),
    ]).join(' '),
    `⚔️${atk} 🛡${def} 🔥${exp} 💰${gold}`,
  ].join('\n');

}


function tagName(name) {
  const [, tag = null] = name.match(/\[(.+)\]/) || [];
  return tag;
}

function battleDate(reportDate) {

  const date = addHours(reportDate, BATTLE_HOUR);
  const hours = Math.floor(date.getUTCHours() / 8) * 8;

  date.setUTCHours(hours);
  date.setSeconds(0);
  date.setMinutes(0);
  date.setMilliseconds(0);

  return date;

}

function dateFormat(date) {
  return `${battleIcon(date)} ${dayPart(date)}`;
}

function dayPart(date) {
  return format(date, 'DD/MM');
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
  battleCries: { test: 'Your battle cries were successful', icon: '🗣', label: 'Successful battle cries' },
  staminaRestored: { test: '🔋Stamina restored', icon: '🔋', label: 'Stamina restored' },
  luckyDefender: { test: '⚡Lucky Defender!', icon: '✌️', label: 'Lucky Defender' },
  criticalStrike: { test: '⚡Critical strike', icon: '⚡', label: 'Critical strike' },
  inspiredBy: { test: /⚡Battle Cry\. You were inspired by (.+)/, icon: '🤟', label: 'Inspired by' },
  taunts: { test: 'Your taunts were successful', icon: '🕺', label: 'Successful taunts' },
  medal: { test: /🏅(.+)/, icon: '🏅', label: '' },
  ga: { test: '🔱Guardian angel', icon: '🔱', label: 'Guardian angel' },
};

function effectIcon(val, e) {
  return fpGet('icon')(BATTLE_EFFECTS[e]);
}

function effectInfo(val, e) {

  const { icon, label } = BATTLE_EFFECTS[e] || {};

  return filter([
    icon || '✅️',
    label,
    `${val && val !== true ? val : ''}`,
  ]).join(' ');

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
