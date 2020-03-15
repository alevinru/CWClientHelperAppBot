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
import globalSetting from '../services/globalSetting';

const { debug } = log('mw:alliances');

export function authAlliances(ctx) {
  const { profile } = ctx.session;
  if (!profile) {
    return false;
  }
  const { tags = [] } = globalSetting.getValue('alliances') || {};
  debug('authAlliances', tags, profile.guild_tag);
  return tags.indexOf(profile.guild_tag) >= 0;
}

export function tasksFilter(ctx) {

  const { message } = ctx;
  const { text } = message;

  if (!text) {
    return false;
  }

  return lo.startsWith(text, '/allianceTasks')
    && authAlliances(ctx);

}

const FOUND_LOCATION_START = 'You found hidden location';
const FOUND_LOCATION = `${FOUND_LOCATION_START} (.+) lvl\\.(\\d+) .+: ([^ ]+)$`;
const FOUND_LOCATION_RE = new RegExp(FOUND_LOCATION);

const FOUND_HEADQUARTER_START = 'You found hidden headquarter';
const FOUND_HEADQUARTER = `${FOUND_HEADQUARTER_START} (.+)\\n.* ([^ ]+)$`;
const FOUND_HEADQUARTER_RE = new RegExp(FOUND_HEADQUARTER);

export function foundObjectiveFilter(ctx) {
  const { text } = ctx.message;
  return text
    && fromCWFilter(ctx)
    && lo.startsWith(text, FOUND_LOCATION_START)
    && authAlliances(ctx);
}

export function foundHeadquarterFilter(ctx) {
  const { text } = ctx.message;
  return text
    && fromCWFilter(ctx)
    && lo.startsWith(text, FOUND_HEADQUARTER_START)
    && authAlliances(ctx);
}

async function enabledAllianceInfo(ctx) {
  return authAlliances(ctx) && Chat.findValue(ctx.chat.id, c.CHAT_SETTING_ALLIANCE_INFO);
}

export async function parseFoundLocation(ctx) {

  const { text } = ctx.message;

  const joined = text.replace(/\n/g, ' ');
  const [, name, lvl, code] = joined.match(FOUND_LOCATION_RE) || [];

  debug('parseFoundLocation', name, lvl, code);

  if (!name || !lvl || !code) {
    return;
  }

  if (!await enabledAllianceInfo(ctx)) {
    return;
  }

  const level = parseInt(lvl, 0);

  const doc = { name, level };

  const op = await AllianceLocation.updateOne({ code }, doc, { upsert: true });

  const { upserted, nModified } = op;

  const header = [];

  if (upserted) {
    header.push('🆕 location');
  } else if (nModified) {
    header.push('Updated location');
  } else {
    header.push('Existing location');
  }

  const fullName = `${name} lvl.${lvl}`;

  header.push(`<b>${fullName}</b>`);
  header.push(`<code>${code}</code>`);

  const reply = [header.join(' ')];

  const owner = await a.locationOwner({ name: fullName });

  if (owner) {
    reply.push(`🚩 <b>${owner.name}</b> since ${b.dateFormat(owner.date)}`);
  }

  await ctx.replyWithHTML(reply.join('\n'));

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

  const { text, reply_to_message: replyTo } = ctx.message;

  const tasksText = replyTo ? replyTo.text : text;

  const alliances = await Alliance.find();

  const targetsMap = new Map(alliances.map(i => [i.name, i.code]));

  const tasks = a.parseAllianceTask(tasksText);
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
      // return `<code>${al.code}</code> ${al.name}`;
      return `/af_${al.code} ${al.name}`;
    }),
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}


export async function showAllianceByName(ctx) {

  const [, name] = ctx.match;
  const $regex = new RegExp(lo.escapeRegExp(name), 'i');
  const alliance = await Alliance.findOne({ name: { $regex } });

  if (!alliance) {
    await ctx.replyWithHTML(`Not found alliance with name <b>${name}</b>`);
    return;
  }

  const locations = await a.allianceLocations(alliance);
  alliance.tags = await a.allianceTags(alliance);

  await ctx.replyWithHTML(allianceView(alliance, locations).join('\n'));

}

export async function showAllianceByCode(ctx) {

  const [, code] = ctx.match;
  const alliance = await Alliance.findOne({ code });

  if (!alliance) {
    await ctx.replyWithHTML(`Not found alliance with code <code>${code}</code>`);
    return;
  }

  const locations = await a.allianceLocations(alliance);
  alliance.tags = await a.allianceTags(alliance);

  await ctx.replyWithHTML(allianceView(alliance, locations).join('\n'));

}


function allianceView(alliance, locations = []) {

  const { tags = [], name, code } = alliance.toObject();

  const res = [
    `<b>${name}</b> ${a.atkLink('⚔️', code)}`,
    '',
    `🆔 <code>${code}</code>`,
    `🏷 ${tags.length ? tags.join(', ') : 'no information'}`,
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
