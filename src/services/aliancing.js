import lo from 'lodash';
import { filterSeriesAsync } from 'sistemium-telegram/services/async';
import * as b from './battles';

// import Alliance from '../models/Alliance';
// import AllianceLocation from '../models/AllianceLocation';
import AllianceBattle from '../models/AllianceBattle';
import AllianceMapState from '../models/AllianceMapState';

import log from './log';

const { debug } = log('mw:alliance');

debug('alliance-ing');

export async function locationsOfAlliance(alliance) {

  if (!alliance) {
    return null;
  }

  const $match = { 'results.belongsTo': alliance.name };

  const battles = await AllianceMapState.aggregate([
    { $match },
    { $sort: { date: 1 } },
    { $unwind: '$results' },
    { $match },
  ])
    .sort({ date: -1 });

  const namesArray = battles.map(({ date, results: { name } }) => ({ name, date }));

  const names = lo.keyBy(namesArray, 'name');
  return filterSeriesAsync(lo.map(names), async ({ name }) => {
    const owner = await locationOwner(name);
    const seemExpired = await locationSeemsExpired(name);
    return owner && owner.name === alliance.name && !seemExpired;
  });

}

export async function locationSeemsExpired(fullName) {
  const lastBattleTime = b.battleDate(new Date()).getTime();
  const [lastBattle] = await locationBattles(fullName).limit(1);
  return lastBattle && lastBattle.date.getTime() !== lastBattleTime;
}

export async function locationOwners(allianceLocation) {

  if (!allianceLocation) {
    return null;
  }

  const $elemMatch = {
    belongsTo: { $ne: null },
    name: allianceLocation.fullName,
  };

  const $match = { results: { $elemMatch } };

  const battles = await AllianceMapState.aggregate([
    { $match },
    { $sort: { date: 1 } },
    { $unwind: '$results' },
    { $match: lo.mapKeys($elemMatch, (val, key) => `results.${key}`) },
  ])
    .sort({ date: -1 });

  const namesArray = battles.map(({ date, results: { belongsTo: name } }) => ({ name, date }));

  const names = lo.keyBy(namesArray, 'name');
  return lo.map(names);

}

export function locationBattles(fullName) {

  return AllianceMapState.find({
    'results.name': fullName,
  }, { 'results.$': 1, date: 1 }).sort({ date: -1 });

}

export async function locationOwner(name) {

  const battle = await AllianceMapState.findOne({
    results: { $elemMatch: { name, belongsTo: { $ne: null } } },
  }, { 'results.$': 1, date: 1 })
    .sort({ date: -1 });

  if (!battle) {
    return null;
  }

  // debug(battle.results);

  return { date: battle.date, name: battle.results[0].belongsTo };

}

export async function allianceNameByTag(tag) {

  const $regex = new RegExp(`\\[${tag}]`, 'i');

  const battle = await AllianceBattle.findOne({
    results: { $elemMatch: { defLeaders: { $regex } } },
  }, { 'results.$': 1, date: 1 })
    .sort({ date: -1 });

  return battle && battle.results[0].name;

}

export async function allianceTags(alliance) {

  if (!alliance) {
    return null;
  }

  const battles = await AllianceBattle.find({
    results: { $elemMatch: { name: alliance.name, defLeaders: { $ne: null } } },
  }, { 'results.$': 1, date: 1 })
    .sort({ date: -1 });

  const tagsArray = battles.map(({ date, results: [{ defLeaders }] }) => ({
    tags: defLeaders.map(tagFromLeader),
    date,
  }));

  const tags = lo.uniq(lo.flatMap(tagsArray, 'tags'));

  // debug(tags);

  return lo.orderBy(tags);

}

function tagFromLeader(leader) {
  const [, tag] = leader.match(/\[(.+)]/);
  return tag;
}

export function allianceBattleView(allianceBattle) {

  const { date, reportLink, results } = allianceBattle;

  const orderedResults = lo.orderBy(results, 'name');

  return [
    `<b>${b.dateFormat(date)}</b> alliances battle`,
    '',
    `<a href="${b.reportLinkHref(reportLink)}">Headquarters report</a>`,
    '',
    ...lo.map(orderedResults, battleResultView),
  ];

}


export function allianceMapStateView(allianceMapState) {

  const { reportLink, results } = allianceMapState;

  const orderedResults = lo.orderBy(results, 'name');

  return [
    `<a href="${b.reportLinkHref(reportLink)}">Map state report</a>`,
    '',
    ...lo.map(orderedResults, mapStateResultView),
  ];

}


function battleResultView(result) {

  const { stock, glory } = result;

  return lo.filter([
    b.difficultyStatus(result),
    result.name,
    stock && `<code>-${stock}</code>📦`,
    glory && `<code>-${glory}</code>🎖`,
  ]).join(' ');

}


function mapStateResultView(result) {

  const { belongsTo } = result;

  return lo.filter([
    b.difficultyStatus(result),
    result.name,
    belongsTo && `🚩 ${belongsTo}`,
  ]).join(' ');

}

export function allianceTagTasksView({ tag, tasks }, targets = new Map(), title) {

  return [
    `${title || ''}<b>${tag}</b>`,
    tasks.map(({ target, names }) => {
      const alliance = targets.get(target);
      const atk = alliance ? `/ga_atk_${alliance}` : target;
      return [
        `<a href="http://t.me/share/url?url=${atk}">${target}</a>`,
        '👉',
        names.join(', '),
      ].join(' ');
    }).join('\n\n'),
  ];

}

export function atkLink(name, code, cmd = '/ga_atk_') {
  return `<a href="http://t.me/share/url?url=${cmd}${code}">${name}</a>`;
}

export function defLink(name, code) {
  return atkLink(name, code, '/ga_def_');
}

const TASK_LINE_RE = /^(.{2,3})[ \t]{2,}(.+)[ \t]{2,}(.+ .+)$/;

export function parseAllianceTask(text) {

  const lines = text.split('\n');

  const tasks = lines.map(line => {
    const [, tag, name, target] = line.match(TASK_LINE_RE) || [];
    return tag && name && target && { tag, name, target };
  });

  return lo.filter(tasks);

}

export function allianceTasksByTag(tasks) {

  const byTag = lo.groupBy(tasks, 'tag');

  const res = lo.map(byTag, (tagTasks, tag) => {
    const byTarget = lo.groupBy(tagTasks, 'target');
    const byTargetArray = lo.map(byTarget, (names, target) => ({
      target,
      names: lo.map(lo.orderBy(names, 'name'), ({ name }) => lo.trim(name)),
    }));
    return {
      tag,
      tasks: lo.orderBy(byTargetArray, 'target'),
    };
  });

  return lo.orderBy(res, 'tag');

}
