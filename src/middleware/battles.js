import { format, addHours } from 'date-fns';

import log from '../services/log';

import { fromCWFilter } from '../config/filters';

import BattleReport from '../models/BattleReport';

const { debug } = log('mw:battles');

const BATTLE_HOUR = parseInt(process.env.BATTLE_HOUR || '5', 0);

const { BATTLE_TEXT = 'Your result on the battlefield' } = process.env;

const BATTLE_STATS_RE = /..(.*) .:(.+) ..:(.+) Lvl: (\d+)/;

export function reportFilter(ctx) {

  const { state, message, from: { id: userId } } = ctx;
  const { text, forward_date: forwardDate } = message;

  if (!text && !fromCWFilter(ctx)) {
    return false;
  }

  const isReport = new RegExp(BATTLE_TEXT).test(text);

  if (!isReport) {
    return false;
  }

  const reportDate = new Date(forwardDate * 1000);
  const [, name, atkInfo = '', defInfo = '', level] = text.match(BATTLE_STATS_RE) || [];
  const date = addHours(reportDate, -BATTLE_HOUR);

  const [, gold] = text.match(/Gold: (\d+)/) || [];
  const [, exp] = text.match(/Exp: (\d+)/) || [];
  const [, hp] = text.match(/Hp: (\d+)/) || [];

  const [, atk, healAtk = '0'] = atkInfo.match(/(\d+)\(([-+]\d+)\)/) || ['', atkInfo];
  const [, def, healDef = '0'] = defInfo.match(/(\d+)\(([-+]\d+)\)/) || ['', defInfo];

  date.setSeconds(0);
  date.setMinutes(0);

  debug('reportFilter', isReport, forwardDate);

  Object.assign(state, {
    battle: {
      userId,
      castle: text.substr(0, 2),
      text,
      reportDate,
      date,
      name,
      stats: {
        atk: parseInt(atk, 0),
        healAtk: parseInt(healAtk, 0),
        def: parseInt(def, 0),
        healDef: parseInt(healDef, 0),
        level: parseInt(level, 0),
      },
      gold,
      exp,
      hp,
    },
  });

  debug(state);

  return isReport;

}

export async function onReportForward(ctx) {

  const { state: { battle }, chat, from } = ctx;

  debug('onReportForward:', battle);

  await new BattleReport(battle).save();

  if (chat.id !== from.id) {
    return;
  }

  const reply = [
    `Got ${battle.castle} <b>${battle.name}</b> report`,
    `for <b>${dateFormat(battle.date)}</b>`,
  ].join(' ');

  await ctx.replyWithHTML(reply);

}


function dateFormat(date) {
  return format(date, 'D/MM');
}
