import { addHours, differenceInHours } from 'date-fns';
import filter from 'lodash/filter';
import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import fpGet from 'lodash/fp/get';
import fpSumBy from 'lodash/fp/sumBy';
import omit from 'lodash/omit';
import set from 'lodash/set';
import max from 'lodash/max';

import log from '../services/log';
import { fromCWFilter } from '../config/filters';
import * as b from '../services/battles';

import BattleReport, { MobBattleReport } from '../models/BattleReport';
// import User from '../models/User';

const { debug, error } = log('mw:battles');


const ADMIN_ID = parseInt(process.env.ADMIN_ID, 0);

const aggregate = path => fpSumBy(fpGet(path));

export function reportFilter(ctx) {

  const { state, message, from: { id: userId } } = ctx;
  const { text, forward_date: forwardDate } = message;

  if (!text || !fromCWFilter(ctx)) {
    return false;
  }

  const battle = b.battleFromText(text, forwardDate);

  if (!battle) {
    return false;
  }

  battle.userId = userId;

  Object.assign(state, { battle });
  // debug(battle);

  return true;

}

export async function onReportForward(ctx) {

  const { state: { battle }, chat, from } = ctx;

  // debug('onReportForward:', battle);

  const { date, name } = battle;
  const key = { date, name };

  const $setOnInsert = omit(battle, Object.keys(key));

  const args = [
    key,
    {
      $setOnInsert,
      $set: {
        ts: new Date(),
      },
      // $currentDate: { ts: true },
    },
    { upsert: true },
  ];

  const { nModified } = battle.isMob
    ? await MobBattleReport.updateOne(...args)
    : await BattleReport.updateOne(...args);

  debug('onReportForward:', nModified);

  if (chat.id !== from.id) {
    return;
  }

  const got = nModified ? 'Updated' : 'Got';

  const { _id: id } = battle.isMob
    ? await MobBattleReport.findOne(key) : await BattleReport.findOne(key);

  const reply = !battle.isMob ? gotBattleReport(battle, got, id) : gotMobReport(battle, got);

  await ctx.replyWithHTML(reply.join('\n'));

}

function gotBattleReport(battle, got, id) {
  return [
    `${battle.castle} ${got} <b>${battle.name}</b>`,
    `report for <b>${b.dateFormat(battle.date)}</b>`,
    `/rb_${id}`,
  ];
}

function gotMobReport(battle, got) {
  return [
    `👾 ${got} mob report`,
    `of ${battle.castle}<b>${battle.name}</b>`,
    `at <b>${b.dayTime(battle.reportDate)}</b>`,
  ];
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
  const [, from = '1', to] = match;

  if (!profile) {
    return;
  }

  const battles = parseInt(from, 0) || 1;
  const battlesTo = parseInt(to, 0) || 1;

  const { userName, guild_tag: tag } = profile;

  const name = `${tag && `[${tag}]`}${userName}`;

  const dateE = addHours(b.battleDate(new Date()), (1 - battlesTo) * 8);

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
    const dateELabel = b.dateFormat(dateE);
    const periodLabel = differenceInHours(dateB, dateE)
      ? `${b.dateFormat(dateB)} - ${dateELabel}` : dateELabel;
    return [
      'No battle report found',
      `of <b>${filters.name}</b>`,
      `for <b>${periodLabel}</b>`,
    ];
  }

  const rows = reports.map(report => {

    const { stats: { atk, def }, exp, gold } = report;
    const icons = map(report.effects, b.effectIcon).join('');

    return filter([
      `<b>${b.dateFormat(report.date)}</b> ${reports.length > 1 ? icons : ''}`,
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
    const effectsInfo = map(reports[0].effects, b.effectInfo);
    if (effectsInfo.length) {
      res.push('', effectsInfo.join('\n'));
    }
    if (!fpGet('_id')(filters)) {
      res.push('', `/rb_${fpGet('[0]._id')(reports)}`);
    }
  } else {

    const battlesCnt = differenceInHours(dateE, dateB) / 8 + 1;
    const attendInfo = `<b>${reports.length}/${battlesCnt}</b>`;

    res.push('', `${attendInfo} 🔥${aggregate('exp')(reports)} 💰${aggregate('gold')(reports)}`);

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
  const tag = matchTag || ownTag;

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

  const dateLabel = [b.dateFormat(date)];

  if (days > 1) {
    dateLabel.splice(0, 0, [
      `for <b>${days}</b> battles`, `from ${b.dateFormat($gte)} to`,
    ].join('\n'));
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
      map(effects, b.effectIcon).join(''),
    ]).join(' '),
    `⚔️${atk} 🛡${def} 🔥${exp} 💰${gold}`,
  ].join('\n');

}
