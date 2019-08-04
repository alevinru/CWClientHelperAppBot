import filter from 'lodash/filter';
import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import find from 'lodash/find';
import omit from 'lodash/omit';
import fpOmit from 'lodash/fp/omit';
import keyBy from 'lodash/keyBy';
import groupBy from 'lodash/groupBy';
import padStart from 'lodash/padStart';
// import set from 'lodash/set';

import log from '../services/log';
import * as b from '../services/battles';

import Battle from '../models/Battle';
import BattleReport from '../models/BattleReport';

const { debug } = log('mw:battles');

const { BATTLE_DIGEST } = process.env;

const { BATTLE_RESULTS = '⛳️Battle results:' } = process.env;
const BATTLE_TEXT_RE = new RegExp(BATTLE_RESULTS);
const CASTLES_HASH = JSON.parse(process.env.CASTLES);
const CASTLES = map(CASTLES_HASH);

export function reportFilter(ctx) {

  const { state, message, from: { id: userId } } = ctx;
  const { text, forward_date: forwardDate, forward_signature: digestName } = message;

  if (!text || !digestName) {
    return false;
  }

  if (digestName !== BATTLE_DIGEST) {
    return false;
  }

  if (!BATTLE_TEXT_RE.test(text)) {
    return false;
  }

  const reportDate = new Date(forwardDate * 1000);
  const [resultsText, scoresText] = text.split('\n\n');

  debug('reportFilter', forwardDate, reportDate);

  const resultsArray = filter(resultsText.split('\n').map(resultFromText));

  const results = mergeScores(resultsArray, scoresText.split('\n').map(scoresFromText));

  const battle = {

    date: b.battleDate(reportDate),
    userId,
    reportDate,
    text,
    results,
    result: mapValues(keyBy(results, 'code'), fpOmit(['code'])),

  };

  Object.assign(state, { battle });

  debug(battle);

  return true;


  function resultFromText(resultText) {

    const ga = !!resultText.match(/🔱/);

    const BATTLE_RESULT_RE = new RegExp(`(${CASTLES.join('|')})(.*): ([^ ]+) (.+)`);
    const [, castle, , smileys, etc] = resultText.match(BATTLE_RESULT_RE) || [];
    if (!castle) return null;
    const gold = getValue('💰') || 0;

    // debug('resultFromText', castle, name || CASTLES_HASH[castle], `"${smileys}"`, `"${etc}"`);

    let difficulty = smileys.match(/👌|😎/) ? 0 : ((smileys.match(/⚡/) && 2) || 1);

    if (etc === '😴') {
      difficulty = 0;
    }

    return {
      castle,
      code: b.castleCode(castle),
      gold,
      stock: getValue('📦'),
      result: gold >= 0 ? 'protected' : 'breached',
      ga,
      difficulty,
    };

    function getValue(label) {
      const [, res] = etc.match(`([-+]\\d+)${label}`) || [];
      return res ? parseInt(res, 0) : 0;
    }

  }

  function scoresFromText(scoresLine) {
    const BATTLE_SCORES_RE = new RegExp(`(${CASTLES.join('|')}).+: \\+(\\d+)`);
    const [, castle, scoreString] = scoresLine.match(BATTLE_SCORES_RE) || [];
    if (!castle) return null;
    return {
      castle,
      score: parseInt(scoreString, 0),
    };
  }

}

function mergeScores(results, scores) {
  return map(results, res => {
    const { castle } = res;
    const { score } = find(scores, { castle }) || {};
    return { ...res, score };
  });
}

export async function onReportForward(ctx) {

  const { state: { battle }, chat, from } = ctx;

  debug('onReportForward:', battle);

  const { date } = battle;
  const key = { date };

  const $setOnInsert = omit(battle, Object.keys(key));

  const args = [
    key,
    {
      $setOnInsert,
      $set: { ts: new Date() },
    },
    { upsert: true },
  ];

  const { nModified } = await Battle.updateOne(...args);

  debug('onReportForward:', nModified);

  if (chat.id !== from.id) {
    return;
  }

  const reply = gotBattleReport(battle);

  await ctx.replyWithHTML(reply.join('\n'));

}

function gotBattleReport({ date }) {
  return [
    `Got <b>${b.dateFormat(date)}</b> battle digest`,
    battleCommand(date),
  ];
}

function battleView(battle) {

  const { date, results } = battle;

  const resultsByStatus = groupBy(results, 'result');

  return [
    `<b>${b.dateFormat(date)}</b> battle`,
    ...map(resultsByStatus, (r, code) => {
      return [
        '',
        `${resultStatus(code)} <b>${r.length}</b> ${code}`,
        '',
        ...map(r, battleResultView),
      ].join('\n');
    }),
  ];

}

function resultStatus(result) {

  switch (result) {
    case 'breached':
      return '⚔';
    case 'protected':
      return '🛡';
    default:
      return '';
  }

}

function difficultyStatus(result) {

  if (!result.gold) {
    return '😴';
  }

  switch (result.difficulty) {
    case 0:
      return result.result === 'breached' ? '😎' : '👌';
    case 1:
      return resultStatus(result.result);
    case 2:
      return result.ga ? '🔱' : '⚡';
    default:
      return '🤷‍️';
  }
}

function battleResultView(result) {

  const { gold, atk } = result;

  return filter([
    result.castle,
    `<code>${padStart(result.score, 2, '0')}</code>`,
    difficultyStatus(result),
    gold && `${gold > 0 ? '+' : ''}${gold}💰`,
    atk && `<b>${Math.ceil(atk / 1000)}</b>K`,
  ]).join(' ');

}

export async function setMaster(ctx) {

  const [, reportId, castleCode] = ctx.match;

  const castle = b.castleByCode(castleCode);

  debug('setMaster:', reportId, castleCode, castle);

  if (!castle) {
    await ctx.replyWithHTML(`Invalid castle code <b>${castleCode}</b>`);
    return;
  }

  const report = await BattleReport.findOne({ _id: reportId });

  if (!report) {
    await ctx.replyWithHTML(`Not found report <b>${reportId}</b>`);
    return;
  }

  const { date, _id: id } = report;
  const { gold, stats: { atk } } = report;
  const dateLabel = `<b>${b.dateFormat(date)}</b>`;

  const battle = await Battle.findOne({ date });

  if (!battle) {
    await ctx.replyWithHTML(`Not found battle ${dateLabel}`);
    return;
  }

  const result = battle.result[castleCode];
  const castleAtk = -Math.ceil(result.gold * atk / gold);

  const masterData = {
    atk: castleAtk,
    masterReport: {
      atk, gold, id,
    },
  };

  const resultsRow = find(battle.results, { code: castleCode });

  Object.assign(result, masterData);
  Object.assign(resultsRow, masterData);

  await battle.save();

  const reply = [
    `${dateLabel} set master report`,
    `${battleResultView(resultsRow)}`,
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function showLastBattle(ctx) {

  await showBattle(ctx, b.battleDate(new Date()));

}

export async function showBattleByCode(ctx) {

  const [, dateP, hourP] = ctx.match;
  const [, year, month, day] = dateP.match(/(\d\d)(\d\d)(\d\d)/);

  const date = new Date(`20${year}-${month}-${day} ${hourP}:00:00.000Z`);

  debug('show', dateP, hourP, date);

  await showBattle(ctx, date);

}

async function showBattle(ctx, date) {

  const filters = { date };

  const battle = await Battle.findOne(filters);

  const reply = [];

  if (!battle) {
    reply.push(`<code>Not found</code> ${b.dateFormat(date)} battle`);
  } else {
    reply.push(...battleView(battle));
  }

  const prevDate = b.prevDate(date);
  const nextDate = b.nextDate(date);

  reply.push(...[
    '',
    `${b.battleIcon(prevDate)} ${battleCommand(prevDate)}`,
  ]);

  if (nextDate <= b.battleDate(new Date())) {
    reply.push(`${b.battleIcon(nextDate)} ${battleCommand(nextDate)}`);
  }

  await ctx.replyWithHTML(reply.join('\n'));

}


function battleCommand(date) {
  return `/ba_${b.dateCode(date)}`;
}
