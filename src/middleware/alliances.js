import lo from 'lodash';
import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import log from '../services/log';
import * as b from '../services/battles';
import * as a from '../services/aliancing';

import AllianceBattle from '../models/AllianceBattle';
import AllianceMapState from '../models/AllianceMapState';

const { debug } = log('mw:alliances');

export function tasksFilter(ctx) {

  const { message } = ctx;
  const { text } = message;

  if (!text) {
    return false;
  }

  return lo.startsWith(text, '/allianceTasks');

}

const FOUND_LOCATION_START = 'You found hidden location';
const FOUND_LOCATION = `${FOUND_LOCATION_START} (.+) lvl\\.(\\d+)\\n.* ([^ ]+)$`;
const FOUND_LOCATION_RE = new RegExp(FOUND_LOCATION);

const FOUND_HEADQUARTER_START = 'You found hidden headquarter';
const FOUND_HEADQUARTER = `${FOUND_HEADQUARTER_START} (.+)\\n.* ([^ ]+)$`;
const FOUND_HEADQUARTER_RE = new RegExp(FOUND_HEADQUARTER);

export function foundObjectiveFilter(ctx) {
  const { text } = ctx.message;
  return text && lo.startsWith(text, FOUND_LOCATION_START);
}

export function foundHeadquarterFilter(ctx) {
  const { text } = ctx.message;
  return text && lo.startsWith(text, FOUND_HEADQUARTER_START);
}

export async function parseFoundLocation(ctx) {

  const { text } = ctx.message;

  const [, name, lvl, code] = text.match(FOUND_LOCATION_RE) || [];

  debug('parseFoundLocation', name, lvl, code);

  if (!name || !lvl) {
    return;
  }

  await ctx.replyWithHTML([
    name,
    lvl,
    code,
  ].join(' '));

}

export async function parseFoundHeadquarter(ctx) {

  const { text } = ctx.message;

  const [, name, code] = text.match(FOUND_HEADQUARTER_RE) || [];

  debug('parseFoundHeadquarter', name, code);

  if (!name || !code) {
    return;
  }

  await ctx.replyWithHTML([
    name,
    code,
  ].join(' '));

}

export async function parseTasks(ctx) {

  const { text } = ctx.message;

  const tasks = a.parseAllianceTask(text);
  const byTag = a.allianceTasksByTag(tasks);
  const res = byTag.map(a.allianceTagTasksView);

  await eachSeriesAsync(res, async tagView => {
    await ctx.replyWithHTML(tagView.join('\n\n'));
  });

}

export async function showLastAllianceBattle(ctx) {
  await showAllianceBattle(ctx, b.battleDate(new Date()));
}

export async function showAllianceBattleByCode(ctx) {

  const [, dateP, hourP] = ctx.match;
  const [, year, month, day] = dateP.match(/(\d\d)(\d\d)(\d\d)/);

  const date = new Date(`20${year}-${month}-${day} ${hourP}:00:00.000Z`);

  debug('show', dateP, hourP, date);

  await showAllianceBattle(ctx, date);

}

async function showAllianceBattle(ctx, date) {

  const filters = { date };

  const battleMongo = await AllianceBattle.findOne(filters);

  const battle = battleMongo && battleMongo.toObject();

  const reply = [];

  if (!battle) {
    reply.push(`<code>Not found</code> ${b.dateFormat(date)} battle`);
  } else {
    reply.push(...a.allianceBattleView(battle));
  }

  const mapStateMongo = await AllianceMapState.findOne(filters);

  if (mapStateMongo) {
    reply.push('', ...a.allianceMapStateView(mapStateMongo.toObject()));
  }

  await ctx.replyWithHTML(reply.join('\n'), { disable_web_page_preview: true });

}
