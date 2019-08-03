import filter from 'lodash/filter';
import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import find from 'lodash/find';
import omit from 'lodash/omit';
import fpOmit from 'lodash/fp/omit';
import keyBy from 'lodash/keyBy';

import log from '../services/log';
import * as b from '../services/battles';

import Battle from '../models/Battle';

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
    debug('not forward', forwardDate);
    return false;
  }

  // const { id: forwardFromId } = forward_from_chat;

  if (digestName !== BATTLE_DIGEST) {
    debug('not digest', BATTLE_DIGEST, digestName);
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
    result: mapValues(keyBy(results, 'name'), fpOmit(['name'])),

  };

  Object.assign(state, { battle });

  debug(battle);

  return true;


  function resultFromText(resultText) {

    const ga = !!resultText.match(/🔱/);

    const BATTLE_RESULT_RE = new RegExp(`(${CASTLES.join('|')})(.*): ([^ ]+) (.+)`);
    const [, castle, name, smileys, etc] = resultText.match(BATTLE_RESULT_RE) || [];
    if (!castle) return null;
    const gold = getValue('💰') || 0;

    // debug('resultFromText', castle, name || CASTLES_HASH[castle], `"${smileys}"`, `"${etc}"`);

    let difficulty = smileys.match(/👌|😎/) ? 0 : ((smileys.match(/⚡/) && 2) || 1);

    if (etc === '😴') {
      difficulty = 0;
    }

    return {
      castle,
      name: name || b.castleCode(castle),
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

function gotBattleReport(battle) {
  return [
    `Got <b>${b.dateFormat(battle.date)}</b> battle digest`,
  ];
}
