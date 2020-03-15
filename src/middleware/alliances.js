import lo from 'lodash';
import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import log from '../services/log';
import * as b from '../services/battles';
import * as a from '../services/aliancing';
import { fromCWFilter } from '../config/filters';

import Alliance from '../models/Alliance';
import AllianceLocation from '../models/AllianceLocation';
import AllianceBattle from '../models/AllianceBattle';
import AllianceMapState from '../models/AllianceMapState';
import Chat, * as c from '../models/Chat';

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
  return text && fromCWFilter(ctx) && lo.startsWith(text, FOUND_LOCATION_START);
}

export function foundHeadquarterFilter(ctx) {
  const { text } = ctx.message;
  return text && fromCWFilter(ctx) && lo.startsWith(text, FOUND_HEADQUARTER_START);
}

async function enabledAllianceInfo(ctx) {
  return Chat.findValue(ctx.chat.id, c.CHAT_SETTING_ALLIANCE_INFO);
}

export async function parseFoundLocation(ctx) {

  const { text } = ctx.message;

  const [, name, lvl, code] = text.match(FOUND_LOCATION_RE) || [];

  debug('parseFoundLocation', name, lvl, code);

  if (!name || !lvl) {
    return;
  }

  if (!await enabledAllianceInfo(ctx)) {
    return;
  }

  const level = parseInt(lvl, 0);

  const reply = [];

  const doc = { name, level };

  const op = await AllianceLocation.updateOne({ code }, doc, { upsert: true });

  const { upserted, nModified } = op;

  if (upserted) {
    reply.push('🆕 location');
  } else if (nModified) {
    reply.push('Updated location');
  } else {
    reply.push('Existing location');
  }

  await ctx.replyWithHTML([
    ...reply,
    `<b>${name} lvl.${lvl}</b>`,
    `<code>${code}</code>`,
  ].join(' '));

}

export async function parseFoundHeadquarter(ctx) {

  const { text } = ctx.message;

  const [, name, code] = text.match(FOUND_HEADQUARTER_RE) || [];

  debug('parseFoundHeadquarter', name, code);

  if (!name || !code) {
    return;
  }

  if (!await enabledAllianceInfo(ctx)) {
    return;
  }

  const reply = [];

  const op = await Alliance.updateOne({ code }, { name }, { upsert: true });

  const { upserted, nModified } = op;

  if (upserted) {
    reply.push('🆕 headquarter');
  } else if (nModified) {
    reply.push('Updated headquarter');
  } else {
    reply.push('Existing headquarter');
  }

  await ctx.replyWithHTML([
    ...reply,
    `<b>${name}</b>`,
    `<code>${code}</code>`,
  ].join(' '));

}

export async function parseTasks(ctx) {

  const { text } = ctx.message;

  const alliances = await Alliance.find();

  const targetsMap = new Map(alliances.map(i => [i.name, i.code]));

  const tasks = a.parseAllianceTask(text);
  const byTag = a.allianceTasksByTag(tasks);
  const res = byTag.map(t => a.allianceTagTasksView(t, targetsMap));

  debug('parseTasks', alliances.length, tasks.length, byTag.length, res.length);

  await eachSeriesAsync(res, async tagView => {
    await ctx.replyWithHTML(tagView.join('\n\n'));
  });

}

export async function showLastAllianceBattle(ctx) {
  await showAllianceBattle(ctx, b.battleDate(new Date()));
}

export async function showAlliances(ctx) {

  if (!await enabledAllianceInfo(ctx)) {
    return;
  }

  const alliances = await Alliance.find()
    .sort({ name: 1 });

  const reply = [
    '<b>Alliances</b>',
    '',
    ...alliances.map(al => {
      return `<code>${al.code}</code> ${al.name}`;
    }),
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}


export async function showAllianceByName(ctx) {

  const [, name] = ctx.match;
  const $regex = new RegExp(lo.escapeRegExp(name), 'i');
  const alliance = await Alliance.findOne({ name: { $regex } });

  if (!alliance) {
    await ctx.replyWithHTML(`Not found alliance with name <b>${name}/b>`);
    return;
  }

  const locations = await a.allianceLocations(alliance);

  await ctx.replyWithHTML(allianceView(alliance, alliance.code, locations).join('\n'));

}

export async function showAlliance(ctx) {

  const [, code] = ctx.match;
  const alliance = await Alliance.findOne({ code });

  const locations = await a.allianceLocations(alliance);

  await ctx.replyWithHTML(allianceView(alliance, code, locations).join('\n'));

}


function allianceView(alliance, code, locations = []) {

  if (!alliance) {
    return [`Not found alliance with code <code>${code}</code>`];
  }

  const { tags = [], name } = alliance.toObject();

  const res = [
    `<b>${name}</b> ${a.atkLink('⚔️', code)}`,
    '',
    `code: <code>${code}</code>`,
    `tags: ${tags.length ? tags.join(', ') : 'no information'}`,
  ];

  if (locations.length) {
    res.push('', ...locations.map(l => `${b.dateFormat(l.date)} 🚩 ${l.name}`));
  }

  return res;

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
