import filter from 'lodash/filter';
import map from 'lodash/map';
import find from 'lodash/find';
import omit from 'lodash/omit';
import padStart from 'lodash/padStart';
import orderBy from 'lodash/orderBy';
import sumBy from 'lodash/sumBy';

import log from '../services/log';
import * as b from '../services/battles';

import Battle from '../models/Battle';
import BattleReport from '../models/BattleReport';

const { debug } = log('mw:battles');
const ADMIN_ID = parseInt(process.env.ADMIN_ID, 0);

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

export function battleView(battle) {

  const { date, results, reportLink } = battle;

  const resultsByStatus = b.battleResultsArray(battle);

  const res = [
    `<b>${b.dateFormat(date)}</b> battle`,
    ...map(resultsByStatus, ({ results: r, code }) => {
      return [
        '',
        `${b.resultStatus(code)} <b>${r.length}</b> ${code}`,
        '',
        ...map(orderBy(r, ['score'], ['desc']), battleResultView),
      ].join('\n');
    }),
  ];

  const atk = sumBy(results, 'atk');

  if (atk) {
    res.push('', `👊 <b>${Math.ceil(atk / 1000.0)}</b>K total`);
  }

  if (reportLink) {
    res.push('', `<a href="${b.reportLinkHref(reportLink)}">Full report</a>`);
  }

  return res;

}

function battleResultView(result) {

  const { gold, atk } = result;

  return filter([
    result.castle,
    `<code>${padStart(result.score, 2, '0')}</code>`,
    b.difficultyStatus(result),
    gold && `${gold > 0 ? '+' : ''}${gold}💰`,
    atk && `${Math.ceil(atk / 1000)}K👊`,
  ]).join(' ');

}

export async function setMaster(ctx) {

  const [, reportId, castleCode] = ctx.match;

  const castle = b.castleByCode(castleCode);

  debug('setMaster:', reportId, castleCode, castle);

  if (!castle) {
    await ctx.replyWithHTML(`⚠ invalid castle code <b>${castleCode}</b>`);
    return;
  }

  const report = await BattleReport.findOne({ _id: reportId });

  if (!report) {
    await ctx.replyWithHTML(`Not found report <b>${reportId}</b>`);
    return;
  }

  const { date, _id: id } = report;
  const { gold, stats: { atk, def } } = report;
  const dateLabel = `<b>${b.dateFormat(date)}</b>`;

  const battle = await Battle.findOne({ date });

  if (!battle) {
    await ctx.replyWithHTML(`Not found battle ${dateLabel}`);
    return;
  }


  const result = find(battle.results, { code: castleCode });
  const stat = result.result === 'breached' ? atk : def;

  if (stat < 100 || gold < 8) {
    await ctx.replyWithHTML('⚠ <code>Invalid report</code> need at least 8 gold and 100 stat');
    return;
  }

  const castleAtk = Math.ceil(Math.abs(result.gold) * stat / gold);

  const masterData = {
    atk: castleAtk,
    masterReport: {
      atk,
      def,
      gold,
      id,
    },
  };

  Object.assign(result, masterData);

  await battle.save();

  const reply = [
    `${dateLabel} set master report`,
    `${battleResultView(result)}`,
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

  const battleMongo = await Battle.findOne(filters);

  const battle = battleMongo && battleMongo.toObject();

  const reply = [];

  if (!battle) {
    reply.push(`<code>Not found</code> ${b.dateFormat(date)} battle`);
  } else {

    if (ADMIN_ID !== ctx.from.id) {
      battle.results.forEach(result => {
        delete result.atk; // eslint-disable-line
      });
    }

    reply.push(...battleView(battle));

  }

  b.battleNavs(date, reply, 'ba');

  await ctx.replyWithHTML(reply.join('\n'), { disable_web_page_preview: true });

}


function battleCommand(date) {
  return `/ba_${b.dateCode(date)}`;
}
